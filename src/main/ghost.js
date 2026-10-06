// Show what the agent does.
// - In the page: Playwright's own action annotations (screencast.showActions) on the shell's connection, which the
//   MCP tools use: a mark at the action point, the element outlined, a title; all fade out. Actions of other clients
//   (@playwright/mcp) are not drawn in the page.
// - Over the pane (the window's HTML): a caption from every CDP command through the proxy, from any client.
// Captions go to the window with the profile's workspace; it shows those of the workspace on screen.
function installGhost(shell) {
  const send = (a) => { if (!shell.win.isDestroyed()) shell.win.webContents.send('agent', a); };
  shell.bus.on('agent-command', (c) => {
    const a = describe(c); if (!a) return;
    send({ ws: c.ws, profile: c.profile, ...a });
    shell.bus.emit('agent-action', { ws: c.ws, profile: c.profile, t: Date.now(), ...a });
  });
  // On every connection of the shell (a new one after sign-in mode), for every page in it.
  const annotate = (profile) => {
    const ctx = profile.context; if (!ctx) return;
    // cursor 'none': Playwright's pointer stays at the last action point; the rest fades out after `duration`.
    const on = (page) => page.screencast.showActions({ duration: 1200, position: 'bottom', cursor: 'none', style: {
      point: `width: 22px; height: 22px; border-radius: 50%; border: 3px solid ${profile.color}; box-shadow: 0 0 0 3px #fff8`,
      highlight: `outline: 2px solid ${profile.color}`,
      title: 'font-size: 13px',
    } }).catch(() => {});
    ctx.pages().forEach(on); ctx.on('page', on);
  };
  for (const ws of shell.workspaces.values()) for (const p of ws.profiles.values()) annotate(p);
  shell.bus.on('profile-added', annotate);
}

let lastMove = 0;
function describe({ method, params }) {
  if (method === 'Input.dispatchMouseEvent') {
    if (params.type === 'mousePressed') return { caption: `${params.button === 'right' ? 'right-' : ''}click`, x: params.x, y: params.y };
    if (params.type === 'mouseMoved' && Date.now() - lastMove > 100) { lastMove = Date.now(); return { caption: 'move', x: params.x, y: params.y }; }
    if (params.type === 'mouseWheel') return { caption: 'scroll', x: params.x, y: params.y };
    return null;
  }
  if (method === 'Input.insertText') return { caption: `type "${params.text.slice(0, 40)}"` };
  if (method === 'Input.dispatchKeyEvent' && params.type === 'keyDown') return { caption: `key ${params.key}` };
  if (method === 'Page.navigate') return { caption: `navigate ${params.url}` };
  if (method === 'Page.captureScreenshot') return { caption: 'screenshot' };
  return null;
}

module.exports = { installGhost, describe };
