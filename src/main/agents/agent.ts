// What Kulisa knows of an agent CLI, the same for every one (CLAUDE.md, "Not tied to one agent"; docs/tasks.md,
// "Choosing the agent"): an entry each, in a file of its own (claude.ts, codex.ts), listed in index.ts. Everything
// Kulisa needs to know about one agent is its entry: who makes it and what it needs, how to find it, how to install
// it (its maker's own installer, run by Kulisa for the human), how to start it connected to Kulisa and how to continue
// a conversation. Kulisa's core calls agents through it alone. Each conversation in a task is kept in its agent.json
// (store.ts).
//   id, name, maker, needs   shown in the window when the human chooses
//   site                     the maker's page of it (the Agents window links to it)
//   command                  the program; null: the user's shell only, no agent
//   install                  the maker's installer, a command line for sh (posix) and PowerShell (win32)
//   installDirs              where the installer puts the program (default ~/.local/bin, as the native installers)
//   args(ctx)                arguments that connect it to Kulisa; ctx: { env (the task's, tasks.ts), packages (the folder of
//                            Kulisa's packages for agents: src/agent, packaged its resources; e.g. claude-plugin/),
//                            account (its account's folder, Kulisa's: where it may keep what it is started with) }
//   localFiles               its settings a project keeps out of git (gitignore patterns from its top): copied into a
//                            task's copy when git ignores them (worktrees.ts)
//   resume(saved)            arguments that continue a conversation (saved: as agent.json keeps it), or nothing
//   dirs(folders)            the task's other folders (its copies of the project's other repositories): { args, env }
//                            that give them to it; without, it learns of them from the MCP server's instructions
//   addDir                   how it gets a folder the task gets while it runs, sent by Kulisa even in its turn (never
//                            while it waits for the human): { command(folder), confirm: the words of the question it
//                            asks then, answered with its first choice }; without, a line saying so after its turn
//   trust                    its trust of a folder (it asks the human once per folder: may it run there), kept in its
//                            config: has(where, folder), set(where, folder) (false: not set); where: { configDir, transcript (a
//                            conversation's, to find its config without an account) }. The rule is Kulisa's, the same
//                            for every agent (extendTrust)
//   hooks                    its hooks: which of its events sends which of Kulisa's (agent-hooks.ts), each running
//                            hookCommand; given to it at its start (args), never written into its config. Their input
//                            is Claude Code's shape (session_id, transcript_path), which Codex's take too
//   lacks                    what of CAPABILITIES it cannot do, each with the reason (its version, what its maker
//                            has not built): the human gets the same Kulisa with every agent, so a gap is said, never
//                            left out silently (test/unit/agents.test.ts; docs/tasks.md, "What each agent can do")
//   skills                   where in its config folder it reads its own skills ('skills': <dir>/skills/<name>/SKILL.md):
//                            Kulisa's profiles skill (how to work with the profiles) goes there, into its account's
//                            folder only, never the human's own (installSkill)
//   prompt(text)             the arguments that start it with a first message (the task handed to it: tasks.ts, handOver)
//   conversation(transcript) its transcript read as the task's history (task_history; the entries: transcripts.ts): { entries,
//                            plan, stopped, memory }; without, its runs give the history nothing but Kulisa's part
//   forget(ctx)              a task's copy is deleted: everything the agent keeps of its folder goes (conversations,
//                            the folder's trust, history); ctx { folder, saved (a conversation of it), project (the
//                            project's folder, and a conversation of one of its tasks with a transcript) }
//   config                   its accounts (accounts.ts): { env, home(), login(), status, email(out), logout }:
//                            the variable naming its config folder; the human's own folder (where it keeps its sign-in
//                            without that variable); the arguments of its own sign-in (run in a terminal, it ends when
//                            signed in), of its status (ends with 0 when signed in) and the email in what that says
//                            (none: not known), and of signing out (accountEmail, signOut)
//   voice                    dictation, when the agent has its own (the window's microphone button; none without):
//                            key, repeat  what is typed into its terminal again and again while it records, every
//                                  repeat ms, as a held key repeats (a terminal tells no key's release)
//   language                 its own language setting, which Kulisa's one language (☰ → Language) is written into,
//                            in every account of it (app.ts, setLanguage; tasks.ts, at its start): languages, the
//                            codes it takes; set(dir, code), into an account's config folder
import type { Conversation } from '../transcripts.ts';

// Kulisa's MCP tools that keep the agent's own approval (the author, 2026-10-12; docs/profiles.md, The agent's tools):
// terminal_run runs any command in the human's shell, around the agent's approval of commands (and Codex's sandbox);
// browser_file_upload sends a file of the disk to a site, what a prompt injection would use. Every other tool runs
// without a question, a new one too unless it is added here: what acts on real accounts asks the human in Kulisa itself.
const KULISA_ASKS = ['terminal_run', 'browser_file_upload'];

// A conversation as agent.json keeps it: its session as the agent's hooks reported it (agent-hooks.ts), and its
// account's folder.
interface Saved { sessionId?: string; transcript?: string; started?: boolean; configDir?: string | null }
// Where an agent's program is (findAgent).
interface Found { path: string | null; onPath: boolean }
// What a task tells its agent (tasks.ts): its environment, where Kulisa's packages for agents are.
interface ArgsContext { env: Record<string, string | undefined>; packages: string; account?: string | null }
// Where an agent's config is: its account's folder, else found from a conversation's transcript (Claude's).
interface Where { configDir?: string | null; transcript?: string }
interface ForgetContext { folder: string; saved?: Saved; project?: { folder?: string; transcript?: string }; configDir?: string | null }
interface Agent {
  id: string; name: string; maker: string; command: string | null; needs: string; site?: string; custom?: boolean;
  install?: { posix?: string; win32?: string };
  installDirs?: string[];
  localFiles?: string[];
  args?: (ctx: ArgsContext) => string[];
  resume?: false | ((saved: Saved) => string[] | false | null | undefined | '');
  dirs?: (folders: string[]) => { args: string[]; env?: Record<string, string> };
  addDir?: { command: (folder: string) => string; confirm?: string };
  trust?: { has: (where: Where, folder: string) => boolean; set: (where: Where, folder: string) => boolean };
  forget?: (ctx: ForgetContext) => boolean;
  conversation?: (transcript: string) => Conversation;
  hooks?: Hook[];
  lacks?: Partial<Record<Capability, string>>;
  prompt?: (text: string) => string[];
  skills?: string;
  config?: { env: string; home: () => string; login: () => string[]; status: string[]; email: (out: string) => string | null; logout: string[] };
  voice?: { key: string; repeat: number };
  language?: { languages: string[]; set: (dir: string, code: string) => { error?: string } };
  shell?: { command: string; args?: string[] };
}

// Kulisa's own events, which the agents' hooks send (agent-hooks.ts): a turn begun, waiting for the human, a tool
// finished (working again after waiting), a turn ended, interrupted, the session's start and end.
type HookEvent = 'session-start' | 'prompt' | 'waiting' | 'tool-done' | 'stop' | 'interrupt' | 'session-end';
// One of an agent's hooks: its own event (on), the one it sends Kulisa, and a matcher where the agent takes one.
interface Hook { on: string; sends: HookEvent; matcher?: string }
// What every hook runs: the agent's input posted to its terminal's own URL (KULISA_URL, tasks.ts), Kulisa's answer
// printed (SessionStart's context). The same line in every task, so an agent that asks to trust its hooks (Codex)
// asks once. curl ships with all three OSes; both agents run hooks in sh or bash (Git Bash on Windows). A
// session's end and an interrupt get less time: the agents cut their hooks short there (Codex to 3 s).
const hookSeconds = (e: HookEvent) => (e === 'session-end' ? 1 : e === 'interrupt' ? 2 : 3);
const hookCommand = (e: HookEvent) => `curl -sf --max-time ${hookSeconds(e)} --data-binary @- "$KULISA_URL/hooks/${e}" || true`;

// What Kulisa does with an agent beyond starting it, each an entry's field: an agent has it or says why not (lacks).
const CAPABILITIES = ['config', 'hooks', 'skills', 'resume', 'prompt', 'dirs', 'addDir', 'trust', 'localFiles', 'conversation', 'forget', 'voice', 'language'] as const;
type Capability = typeof CAPABILITIES[number];

export type { Agent, Found, Where, ForgetContext, Hook, HookEvent };
export { KULISA_ASKS, CAPABILITIES, hookSeconds, hookCommand };
