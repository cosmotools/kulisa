// What the Kulisa plugin's hooks ask Kulisa for (src/agent/claude-plugin/hooks/hooks.json), served next to the
// MCP server at /ws/<project>/<n>/hooks/<event> (KULISA_URL is the workspace's). The hook's input (Claude Code's JSON) comes as
// the request body; answers are Claude Code hook output (JSON on the hook's stdout).

// SessionStart: the profiles as they are now, so the agent knows them before its first tool call. Also notes the
// session, so that opening the project again resumes it (workspaces.js).
function sessionStart(ws, input) {
  if (input?.session_id) ws.saveAgent({ sessionId: input.session_id, transcript: input.transcript_path });
  const lines = [...ws.profiles.values()].map((p) => {
    const tabs = p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) =>
      `    - tab ${t.id}${t.id === p.active ? ' (active)' : ''}: "${t.wc.getTitle()}" ${t.wc.getURL()}`);
    return [`- ${p.id} ("${p.name}")${p.signinMode ? ': the human is signing in right now' : ''}`, ...tabs].join('\n');
  });
  const closed = [...ws.closed.values()].map(({ cfg }) => `- ${cfg.id} ("${cfg.name}")`);
  const context = [
    lines.length ? `Kulisa profiles open now (the panes above your terminal; call browser_profiles for the live state):\n${lines.join('\n')}`
      : closed.length ? 'No Kulisa profile is open.' : 'Kulisa has no profiles yet. The human creates them in Profiles ▾ → Manage Profiles…, or use profile_create when a task needs one.',
    closed.length && `Closed profiles (signed in, no pane; profile_open opens one when the task needs it):\n${closed.join('\n')}`,
    !ws.main && `You are in the Kulisa workspace "${ws.name}", a fork of the project: a git worktree of its own on branch ${ws.entry.branch}, ` +
      `and copies of the project's profiles. Run the app under test on its usual ports plus ${ws.offset} (KULISA_PORT_OFFSET); ` +
      'install dependencies first if the worktree has none (node_modules and the like are not copied).',
  ].filter(Boolean).join('\n\n');
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
}

// What the agent is doing, shown on its workspace's tab: working on a prompt, waiting for the human (a permission or
// a question), done.
const state = (s) => (ws) => { ws.setState(s); return {}; };
const handlers = { 'session-start': sessionStart, prompt: state('working'), notification: state('waiting'), stop: state('done') };

// Route /hooks/<event> of a workspace; returns false for other paths.
function handleHookRequest(ws, url, req, res) {
  const m = url.match(/^\/hooks\/([\w-]+)$/);
  if (!m) return false;
  const handler = handlers[m[1]];
  let body = '';
  req.on('data', (d) => { if (body.length < 1e6) body += d; });
  req.on('end', () => {
    let input = null;
    try { input = body ? JSON.parse(body) : null; } catch {}
    res.writeHead(handler ? 200 : 404, { 'content-type': 'application/json' });
    res.end(handler ? JSON.stringify(handler(ws, input)) : '{}');
  });
  return true;
}

module.exports = { handleHookRequest, sessionStart };
