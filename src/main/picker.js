// Point and tell (feature 3): Playwright's page.pickLocator() is the inspector; the payload is built with
// Playwright too (locator string, aria snapshot, box, screenshot with an outline) plus recent console errors
// and failed requests from page events. Large parts go to files. A short reference to them is typed into the
// agent's prompt without Enter: the human writes the rest of the message around it and sends it.
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { typeIntoPrompt } = require('./terminal');

const STYLE_KEYS = ['display', 'visibility', 'opacity', 'position', 'z-index', 'width', 'height', 'margin', 'padding', 'color', 'background-color',
  'font-family', 'font-size', 'font-weight', 'line-height', 'border', 'border-radius', 'cursor', 'pointer-events', 'overflow', 'transform'];

function installPicker(shell) {
  // Profiles in pick mode -> { page, cancel }. Pick mode ends with a click on an element, or is cancelled by Esc
  // in the page or by the Pick button again (pick:cancel).
  shell.picking = new Map();
  ipcMain.handle('pick:cancel', (_e, { profile }) => shell.picking.get(profile)?.cancel());
  ipcMain.handle('pick:start', async (_e, { profile: pid }) => {
    try {
      const profile = shell.profiles.get(pid);
      const page = await profile.page();
      const wc = profile.get().wc;
      let cancelled = false;
      const cancel = () => { cancelled = true; return page.cancelPickLocator().catch(() => {}); };
      const onKey = (e, input) => { if (input.type === 'keyDown' && input.key === 'Escape') { e.preventDefault(); cancel(); } };
      shell.picking.set(pid, { page, cancel });
      wc.on('before-input-event', onKey);
      wc.focus();
      let picked;
      try { picked = await page.pickLocator(); } catch (e) { if (!cancelled) throw e; } finally {
        shell.picking.delete(pid);
        if (!wc.isDestroyed()) wc.off('before-input-event', onKey);
      }
      if (cancelled || !picked) return { cancelled: true };
      const payload = await buildPayload(profile, page, picked, shell.notesDir);
      // One line, short, so the agent CLI shows it in its prompt as typed text (not a collapsed paste).
      const details = path.relative(shell.project, path.join(payload.dir, 'note.md')).split(path.sep).join('/');
      const reference = `[kulisa pick: ${profile.id} ${payload.locator} · details: ${details}] `;
      if (shell.pty) typeIntoPrompt(shell.pty, reference);
      // The human goes on typing in the terminal: move the focus there from the page.
      shell.win.webContents.focus();
      shell.win.webContents.send('terminal:focus');
      return { id: payload.id, locator: payload.locator, reference };
    } catch (e) { return { error: e.message }; }
  });
}

// What the page reported recently, kept by Playwright for every page of the connection.
async function recentTrouble(page) {
  const t = (s) => s.slice(0, 500);
  const consoleErrors = [
    ...(await page.consoleMessages()).filter((m) => m.type() === 'error' || m.type() === 'warning').map((m) => `${m.type()}: ${t(m.text())}`),
    ...(await page.pageErrors()).map((e) => `exception: ${t(String(e.stack || e))}`),
  ].slice(-10);
  const failedRequests = [];
  for (const r of await page.requests()) {
    const failure = r.failure()?.errorText;
    const status = failure ? null : (await r.response().catch(() => null))?.status();
    if (failure || status >= 400) failedRequests.push(`${r.method()} ${r.url()} → ${failure || status}`);
  }
  return { consoleErrors, failedRequests: failedRequests.slice(-10) };
}

async function buildPayload(profile, page, picked, notesDir) {
  let locator = picked;
  try { locator = await picked.normalize(); } catch {}
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${profile.id}`;
  const dir = path.join(notesDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const el = await locator.elementHandle({ timeout: 3000 });
  const info = await el.evaluate((node, keys) => {
    const cs = getComputedStyle(node);
    const styles = Object.fromEntries(keys.map((k) => [k, cs.getPropertyValue(k)]));
    const attrs = Object.fromEntries([...node.attributes].map((a) => [a.name, a.value.slice(0, 200)]));
    const html = node.outerHTML;
    return { tag: node.tagName.toLowerCase(), attrs, styles, text: (node.innerText || '').slice(0, 300), outerHTML: html.slice(0, 4000), outerHTMLLength: html.length };
  }, STYLE_KEYS);
  const box = await locator.boundingBox();
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  let screenshot = null;
  if (box) {
    const pad = 40;
    const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
    const clip = { x, y, width: Math.min(vp.w - x, box.width + 2 * pad), height: Math.min(vp.h - y, box.height + 2 * pad) };
    await el.evaluate((n) => n.setAttribute('data-kulisa-pick', ''));
    screenshot = path.join(dir, 'element.png');
    await page.screenshot({ path: screenshot, clip, style: '[data-kulisa-pick]{outline:3px solid #f0f !important;outline-offset:2px !important}' }).catch(() => (screenshot = null));
    await el.evaluate((n) => n.removeAttribute('data-kulisa-pick')).catch(() => {});
  }
  const aria = await locator.ariaSnapshot({ timeout: 3000 }).catch(() => '');
  const payload = {
    id, dir, profile: profile.name, profileId: profile.id, url: page.url(), title: await page.title(),
    locator: locator.toString(), box, viewport: vp, ...info, aria, screenshot, ...(await recentTrouble(page)),
  };
  fs.writeFileSync(path.join(dir, 'element.html'), info.outerHTML);
  fs.writeFileSync(path.join(dir, 'note.md'), [
    `# Point-and-tell note`, ``,
    `- Profile: **${payload.profile}** (id \`${payload.profileId}\`)`, `- Tab: "${payload.title}" ${payload.url}`,
    `- Locator: \`${payload.locator}\``,
    `- Box: ${box ? `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}` : 'not visible'} (viewport ${vp.w}x${vp.h})`,
    screenshot ? `- Screenshot (element outlined): ${screenshot}` : '- Screenshot: none',
    `- Full HTML: ${path.join(dir, 'element.html')} (${info.outerHTMLLength} chars)`, ``,
    `## Aria snapshot of the element`, '```yaml', aria, '```', ``,
    `## Attributes`, '```json', JSON.stringify(info.attrs, null, 1), '```', ``,
    `## Key computed styles`, '```json', JSON.stringify(info.styles, null, 1), '```', ``,
    `## Recent console errors (${payload.consoleErrors.length})`, ...payload.consoleErrors.map((e) => `- ${e}`), ``,
    `## Recent failed requests (${payload.failedRequests.length})`, ...payload.failedRequests.map((r) => `- ${r}`), ``,
  ].join('\n'));
  await el.dispose();
  return payload;
}

module.exports = { installPicker };
