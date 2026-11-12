// Opt-in matched resource probe for task renderer isolation (#392); product regressions live in task-native.spec.ts.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { committed, newTask, openFolder } from './tasks-helpers.ts';
import { taskPage } from './pages.ts';
import { invoke, notLoading, showResources } from './helpers.ts';

for (const workload of ['empty', 'terminals', 'busy-output', 'editor-diff', 'pdf-preview'] as const) test(`retention cost: ${workload}`, async ({ core, ui, call, files }) => {
  test.skip(!process.env.KULISA_COST_REPORT, 'Set KULISA_COST_REPORT to run the resource measurement.');
  test.setTimeout(240000);
  const report = process.env.KULISA_COST_REPORT;
  const folder = committed(path.join(files.root, workload), 'probe.ts', Array.from({ length: 500 }, (_, n) => `export const value${n} = ${n};\n`).join(''));
  fs.appendFileSync(path.join(folder, 'probe.ts'), 'export const changed = true;\n');
  await openFolder(core, ui, folder);
  const first = await core((k) => k.shell.task.key);
  // Remove the fixture's starter task: measured counts include every visited task UI.
  for (const key of await core((k, keep) => k.shell.windows.flatMap((w) => w.tabs.map((t) => t.key)).filter((key) => key !== keep), first)) await invoke(ui, 'task:close', key);
  const keys = [first], samples: unknown[] = [];
  let switchMs = 0, cleanup: unknown;
  await core((k) => {
    const stats = k.stash.costOutput = { messages: 0, bytes: 0 };
    const originals = new Map<Electron.WebContents, Electron.WebContents['send']>();
    const observe = (_event: unknown, wc: Electron.WebContents) => {
      const send = wc.send;
      originals.set(wc, send);
      wc.send = function (channel, ...args) {
        if (channel === 'pty:out') { stats.messages++; stats.bytes += Buffer.byteLength(args[0].data); }
        return send.call(this, channel, ...args);
      };
    };
    for (const wc of k.electron.webContents.getAllWebContents()) observe(null, wc);
    k.electron.app.on('web-contents-created', observe);
    k.stash.stopCostOutput = () => {
      k.electron.app.off('web-contents-created', observe);
      for (const [wc, send] of originals) if (!wc.isDestroyed()) wc.send = send;
    };
  });
  try {
    for (let count = 1; count <= 8; count++) {
      const start = performance.now();
      if (count > 1) keys.push(await newTask(core, ui));
      await notLoading(ui);
      const readyMs = performance.now() - start;
      if (workload === 'terminals') await call('terminal_run', { name: 'probe', command: 'node -e "let n=0;setInterval(()=>console.log(\'probe-\'+(++n)),100)"' });
      if (workload === 'busy-output') await call('terminal_run', { name: 'busy',
        command: 'node -e "let n=0;setInterval(()=>{for(let i=0;i<16;i++)process.stdout.write((++n)+\' \' +\'x\'.repeat(120)+\'\\n\')},16)"' });
      if (workload === 'editor-diff') {
        await showResources(ui, 'Project');
        await (await taskPage(ui)).getByRole('treeitem', { name: 'probe.ts', exact: true }).dblclick();
        await expect((await taskPage(ui)).getByRole('textbox', { name: path.join(folder, 'probe.ts'), exact: true })).toContainText('value0');
        await showResources(ui, 'Diff');
        await expect((await taskPage(ui)).getByRole('region', { name: 'Diff review', exact: true })).toBeVisible();
        await expect((await taskPage(ui)).getByLabel('Code comparison: probe.ts', { exact: true })).toContainText('changed');
      }
      if (workload === 'pdf-preview') {
        const file = await core((k, content) => k.shell.task.saveArtifact({ kind: 'stage-terminal', id: 1 }, 'preview.pdf', content), pdfProbe());
        await showResources(ui, 'Artifacts');
        await (await taskPage(ui)).getByRole('treeitem', { name: path.basename(file), exact: true }).click();
        await expect.poll(() => core((k) => k.shell.task.window.artifactViewer.native.contents?.isLoading() === false)).toBe(true);
      }
      if (![1, 4, 8].includes(count)) continue;
      // CPU is sampled over a defined interval; this wait is measurement, not a readiness assertion.
      await core((k) => k.electron.app.getAppMetrics());
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const metrics = await core((k) => ({
        processes: k.electron.app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, cpu: m.cpu.percentCPUUsage, memory: m.memory })),
        contents: k.electron.webContents.getAllWebContents().map((wc) => ({ id: wc.id, pid: wc.getOSProcessId(), kind: wc.getURL().split('?')[0].split('/').at(-1) })),
        output: { ...k.stash.costOutput },
      }));
      samples.push({ count, readyMs, ...metrics, dedicatedWorkersObserved: ui.context().pages().reduce((n, page) => n + page.workers().length, 0), pss: metrics.processes.map((p) => {
        try { return { pid: p.pid, kib: Number(/^Pss:\s+(\d+)/m.exec(fs.readFileSync(`/proc/${p.pid}/smaps_rollup`, 'utf8'))?.[1]) }; }
        catch { return { pid: p.pid, kib: null }; }
      }) });
    }
    const switchStart = performance.now();
    await invoke(ui, 'task:show', first); await notLoading(ui);
    switchMs = performance.now() - switchStart;
  } finally {
    const closing = performance.now();
    await core((k) => k.stash.stopCostOutput());
    for (const key of [...keys.slice(1), first]) await invoke(ui, 'task:close', key);
    await expect.poll(() => core((k) => k.electron.webContents.getAllWebContents().length)).toBe(1);
    cleanup = { ms: performance.now() - closing, processes: await core((k) => k.electron.app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, memory: m.memory }))) };
  }
  const previous = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) as unknown[] : [];
  fs.writeFileSync(report, JSON.stringify([...previous, { workload, switchMs, samples, cleanup }], null, 2));
});

function pdfProbe() {
  const content = 'BT /F1 24 Tf 50 700 Td (Resource probe) Tj ET\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}endstream`];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(value.length); value += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  return `${value}xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${value.length}\n%%EOF\n`;
}
