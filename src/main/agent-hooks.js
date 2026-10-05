// What the Kulisa plugin's hooks ask Kulisa for (src/agent/claude-plugin/hooks/hooks.json), served next to the
// MCP server at /hooks/<event>. The hook's input (Claude Code's JSON) comes as the request body; answers are
// Claude Code hook output (JSON on the hook's stdout).

// SessionStart: the profiles as they are now, so the agent knows them before its first tool call. Also notes the
// session, so that opening the project again resumes it (app.js).
function sessionStart(shell, input) {
  if (input?.session_id) shell.agentSession?.({ sessionId: input.session_id, transcript: input.transcript_path });
  const lines = [...shell.profiles.values()].map((p) => {
    const tabs = p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) =>
      `    - tab ${t.id}${t.id === p.active ? ' (active)' : ''}: "${t.wc.getTitle()}" ${t.wc.getURL()}`);
    return [`- ${p.id} ("${p.name}")${p.signinMode ? ': the human is signing in right now' : ''}`, ...tabs].join('\n');
  });
  const closed = [...shell.closed.values()].map(({ cfg }) => `- ${cfg.id} ("${cfg.name}")`);
  const context = [
    lines.length ? `Kulisa profiles open now (the panes above your terminal; call browser_profiles for the live state):\n${lines.join('\n')}`
      : closed.length ? 'No Kulisa profile is open.' : 'Kulisa has no profiles yet. The human creates them in Profiles ▾ → Manage Profiles…, or use profile_create when a task needs one.',
    closed.length && `Closed profiles (signed in, no pane; profile_open opens one when the task needs it):\n${closed.join('\n')}`,
  ].filter(Boolean).join('\n\n');
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
}

const handlers = { 'session-start': sessionStart };

// Route /hooks/<event>; returns false for other paths.
function handleHookRequest(shell, req, res) {
  const m = req.url.match(/^\/hooks\/([\w-]+)$/);
  if (!m) return false;
  const handler = handlers[m[1]];
  let body = '';
  req.on('data', (d) => { if (body.length < 1e6) body += d; });
  req.on('end', () => {
    let input = null;
    try { input = body ? JSON.parse(body) : null; } catch {}
    res.writeHead(handler ? 200 : 404, { 'content-type': 'application/json' });
    res.end(handler ? JSON.stringify(handler(shell, input)) : '{}');
  });
  return true;
}

module.exports = { handleHookRequest, sessionStart };
