// What agents' hooks tell Kulisa and ask it for, served next to the MCP server at /task/<project>/<n>/hooks/<event>
// (KULISA_URL is the task's). The events are Kulisa's own; which of an agent's hooks sends which is the agent's
// (Claude Code: src/agent/claude-plugin/hooks/hooks.json; Codex: its entry in agents.ts). The hook's input (the
// agent's JSON: Codex's hooks take Claude Code's shape) comes as the request body; answers are hook output (JSON on
// the hook's stdout).

// The agent may have other browser tools too (the user's MCP servers and plugins stay: profiles.md), some with the same
// names (browser_click …) and their own "profiles" at session start; this says which browser is the human's. Told to
// every agent in the MCP server's instructions, and again next to the profiles at session start.
import type { IncomingMessage, ServerResponse } from 'http';
import { gist } from './history.ts';
import type { Task } from './tasks.ts';

// A hook's input: the agent's JSON (Claude Code's shape; Codex's hooks take it too).
type Input = { session_id?: string; transcript_path?: string } | null;

const ONLY_BROWSER = 'Kulisa profiles are the only browser here: drive them with the kulisa MCP server\'s tools. Do not use ' +
  'another browser\'s tools (Playwright MCP with its own browser, chrome-devtools, Claude in Chrome, cast, others), even ' +
  'when their tools have the same names: that browser is not the one the human sees, and it is not signed in.';

// SessionStart: the profiles as they are now, so the agent knows them before its first tool call. Also notes the
// session, so that opening the project again resumes it (tasks.ts). An agent taking the task over (tasks.ts,
// switchTo) also gets where the task stands, at the start of its context, before its first turn.
// Each profile with who it is (its description, the human's words) or that it is not said: the agent then asks.
const who = ({ id, name, description }: { id: string; name: string; description?: string }) => `- ${id} ("${name}"): ${description ? description.replace(/\s+/g, ' ') : 'who it is is not said'}`;
async function sessionStart(task: Task, input: Input) {
  if (input?.session_id) task.saveAgent({ sessionId: input.session_id, transcript: input.transcript_path });
  const lines = [...task.profiles.values()].map((p) => {
    const tabs = p.tabs.filter((t) => !t.wc.isDestroyed()).map((t) =>
      `    - tab ${t.id}${t.id === p.active ? ' (active)' : ''}: "${t.wc.getTitle()}" ${t.wc.getURL()}`);
    return [`${who(p)}${p.signinMode ? '; the human is signing in right now' : ''}`, ...tabs].join('\n');
  });
  const closed = [...task.closed.values()].map(({ cfg }) => who(cfg));
  const context = [
    ONLY_BROWSER,
    lines.length ? `Kulisa profiles open now (the panes above your terminal; call browser_profiles for the live state):\n${lines.join('\n')}`
      : closed.length ? 'No Kulisa profile is open.' : "Kulisa has no profiles in this project yet. The human makes them in Settings (the gear at the top right) → Profiles and adds them on the project's page, or use profile_create when a task needs one.",
    closed.length && `Closed profiles (signed in, no pane; profile_open opens one when the task needs it):\n${closed.join('\n')}`,
    taskContext(task),
    task.handedOver && await gist(task),
  ].filter(Boolean).join('\n\n');
  task.handedOver = false;
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
}

// What the agent is doing, shown on its task's tab (tasks.md, "Choosing the agent"): working on a prompt
// (prompt), waiting for the human (waiting: a permission, a question, a turn ended by an error), done (stop); unknown
// once the human interrupted it (interrupt: they are there) or its session ended (session-end), but a done one keeps
// "come and see" (Codex ends a session after 30 minutes idle).
const state = (s: Task['state'], when: (task: Task) => boolean = () => true) => (task: Task) => { if (when(task)) task.setState(s); return {}; };
const handlers: Record<string, (task: Task, input: Input) => object | Promise<object>> = {
  'session-start': sessionStart,
  prompt: state('working'),
  waiting: state('waiting'),
  stop: state('done'),
  interrupt: state(null),
  'session-end': state(null, (task) => task.state !== 'done'),
};

// Route /hooks/<event> of a task; returns false for other paths.
function handleHookRequest(task: Task, url: string, req: IncomingMessage, res: ServerResponse) {
  const m = url.match(/^\/hooks\/([\w-]+)$/);
  if (!m) return false;
  const handler = Object.hasOwn(handlers, m[1]) ? handlers[m[1]] : null;
  let body = '';
  req.on('data', (d) => { if (body.length < 1e6) body += d; });
  req.on('end', async () => {
    let input: Input = null;
    try { input = body ? JSON.parse(body) : null; } catch {}
    let out: object = {};
    try { out = handler ? await handler(task, input) : {}; } catch (e) { console.warn('[hooks]', (e as Error).message); }
    res.writeHead(handler ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
  });
  return true;
}

// Where the agent works, for every agent (the MCP server's instructions, and at the session's start): its task, its
// folder and branch, the project's folder that is the human's, its ports, naming the task (tasks.md).
function taskContext(task: Task) {
  const { entry } = task, copies = entry.copies || [];
  const name = `Name the task with task_rename once you know what it is about${copies.length ? ' (its branches take the name)' : ''}.`;
  const shared = task.dirs().filter((d) => !copies.some((c) => c.folder === d));
  const others = [...copies.filter((c) => c.folder !== task.folder).map((c) => `${c.folder} (a worktree of ${c.repo}, branch ${c.branch})`),
    ...shared.map((d) => `${d} (the project's own folder: no git, no copy)`)];
  const more = others.length ? ` The task's other folders: ${others.join('; ')}.` : '';
  if (!copies.length) {
    return `This is the Kulisa task "${task.name}", working right in the project's folder ${task.folder} (no git, so no copy ` +
      `of its own); the app under test runs on its usual ports.${more} ${name}`;
  }
  const repos = [...new Set(copies.map((c) => c.repo))];
  return `This is the Kulisa task "${task.name}": a git worktree of its own, ${task.folder}, on branch ${entry.branch}.${more} The ` +
    `project's ${repos.length > 1 ? `folders ${repos.join(', ')} are` : `folder ${repos[0]} is`} the human's: never change ${repos.length > 1 ? 'them' : 'it'} on your own. Asked to merge your work into main ` +
    "there, first check for the human's uncommitted changes (git status) and stop if there are any. " + name +
    ` Run the app under test on its usual ports plus ${task.offset} (3000 → ${3000 + task.offset}; $KULISA_PORT_OFFSET), through ` +
    "PORT, a --port flag, .env.local or the published ports of docker compose; the profiles' tabs on local addresses already " +
    'point there. If the app cannot run on other ports, tell the human. Install dependencies first if the worktree has none ' +
    '(node_modules and the like are not copied).';
}

export { handleHookRequest, sessionStart, taskContext, ONLY_BROWSER };
