# Kulisa plugin

A Kulisa package ([packages.md](../../docs/packages.md)) connecting agent CLIs to Kulisa: MCP tools, hooks, shared
instructions, CLI adapters and transcript readers. It receives facts and actions through interfaces declared in
`main/core.ts`; the caller implements them. It owns no tasks, profiles, accounts or terminals and imports none of
their implementations or types.

## Boundary

`main/index.ts` is its entry. The main half uses `log.ts` for action logs, `store.ts`'s atomic writer for agent files,
and `remove.ts` for removal with Windows retries. Other Kulisa packages are reached through their entries:
screenshots supplies capture options and identifies the human's captures. `PluginHost` supplies request admission,
context and lifecycle events, captions and task lookup. `TaskAccess`, `ProfileAccess`, `TabAccess` and `TerminalAccess`
expose the operations and live state the tools and hooks need; git results and conversation metadata arrive as facts.

The caller keeps core checks, questions, ownership and platform objects. The Kulisa package handles tool descriptions,
agent instructions, sign-in waiting, highlights, action annotations and transcript formatting. Browser actions use
Playwright through the caller's CDP connection, preserving the sign-in pause.

`resources/` holds the shared Kulisa skill and Claude Code's plugin format (`claude-plugin/.claude-plugin/`),
whose manifest names `kulisa`. Codex receives the same MCP server through its launch configuration. Forge copies the
resources beside the app archive for CLIs to read; the resources are excluded from the archive. The app version is
passed to the Claude manifest by `scripts/version.ts` at `npm version`.

The plugin reports the environment used by browser tools and named Stage-terminal tools through
`TaskAccess.environmentUsed`. The window owns Follow agent: tab selection, scrolling, activity highlighting and
manual pause. CDP clients also report browser activity through the action captions.

## MCP transport

Streamable HTTP on `127.0.0.1` only, admitted by the caller's local-only request check. Each task has
`/task/<project>/<task>/mcp`, each terminal `/task/<project>/<task>/t/<id>/mcp`; project and task identifiers are
percent-encoded. A server and transport per request close with the response. Task access is cached weakly by the
caller so history parts share one identity across requests and disappear with their task.

## Browser tools

Through Kulisa's MCP server. A tool takes a profile by its name, which the handle turns into its id
(`Task.named`), and one acting in a page an optional `tab`. What each tool does is its description in the server's
listing, the one source; how a tool is designed: [Tool design](#tool-design).

**The agent does not ask the human before Kulisa's tools**: it works in the profiles while the
human watches or is away, and a question at every click undoes that; what acts on real accounts asks in Kulisa itself
(`profile_delete`, the sign-in pause). All Kulisa tools are approved through the agent’s launch arguments, including command execution, terminal input and file upload.
Claude Code’s `--settings` allows the plugin’s server (`mcp__plugin_kulisa_kulisa`); Codex receives
`mcp_servers.kulisa.default_tools_approval_mode="approve"`. These overrides are scoped to Kulisa sessions.

What the tools are for, beyond acting as one user:

- **Choosing the profile** by who it is, as cast did: `profile_list` and the session's start give each profile's
  description, or say it is not said. The agent chooses by it, never guessing a role from a name; when none or several
  fit, it asks the human once and saves their answer (`profile_describe`), so no one asks again. The rule is in the
  MCP server's `instructions` too, so agents without the Kulisa skill (one run by hand in the terminal) get it.
- **Several users at once.** `browser_wait_for` waits in any profile, so the agent acts as one user and waits for
  the effect as another (a message, an invite), up to 45 s a call (Codex gives an MCP tool 60 s).
  `browser_snapshot` with `also` reads several profiles' active tabs in one call, to compare what each user sees.
- **Dialogs** opened by an agent action accept `dialog: accept`; otherwise they are dismissed and the answer
  includes the message. A dialog awaiting the human makes tools fail promptly: the page cannot act while it waits.
- **Signing in stays the human's** (Rules): `profile_ask_signin` shows the request over the pane ("sign in,
  please: …"), optionally opens the app's sign-in page first (the window's way, `Profile.navigate`: a sign-in page
  puts the profile in sign-in mode, which cuts Playwright off), and waits until the human is through: the profile
  went through sign-in mode and left it, or its page is no longer the one it was asked on (origin and path). The
  agent's turn goes on instead of ending at "please sign in". Up to 45 s a call; where it was asked is kept across
  calls (10 minutes). A sign-in on the same address (a dialog in the page) is not seen: the human then tells the
  agent.
- **`browser_evaluate`** runs a function the agent writes in the page: made there from its source (no eval in the
  main process; CDP's evaluation is not held to the page's CSP) and called with the element, if one is given. It may
  read anything the page holds, as any script of it: Kulisa does not restrict the agent, and the profile's CDP proxy
  is open to local processes anyway (issue #90). `@playwright/mcp` works too, through the profile's CDP proxy (below).
- **Reading a page without filling the agent's context** ([Tool design](#tool-design),
  "Saving the agent's context"). `browser_snapshot` takes a part: an element (ref or locator, its subtree:
  `locator.ariaSnapshot()`), a depth, or `find`, the lines that match under their ancestors. One larger than about
  10k tokens (Claude Code warns of a tool's answer from there) goes to a file in the task's `artifacts/` (tasks.md, What
  is on the computer), each its own, never replaced, so two can be compared (`artifacts.ts`); the answer
  gives its path and its top levels. A screenshot is kept there too, its path beside the picture. Claude Code is let
  read there in its settings (`agents/claude.ts`), or it would ask each time; Codex reads the whole disk. What a
  page reported is Playwright's (`page.consoleMessages()`, `pageErrors()`, `requests()`: the last 200, 200 and 100):
  the console by level, the requests without the static files that loaded, by address, numbered (a request keeps its
  number), one whole by its number (`browser_network_request`: headers and bodies, a large body to a file as a
  snapshot; cookie and credential headers hidden, as Rules says). An action of the agent marks its page: its answer
  counts the console errors and failed requests since, and `since: action` reads only those; a request still waiting
  for its answer is pending, never waited for.

**The agent points back**: `browser_highlight` outlines elements on a profile's page (Playwright's
`locator.highlight()`, following the element; it works on Trusted Types pages too) and shows its labels in the pane
header, until the human clicks or types in that tab.

**The agent types as a person does**: `browser_type` clears the field and types its text key by key (Playwright's
`pressSequentially`), 40 ms a key, faster for a longer text (about 1.5 s at most), so the human sees it typed and the
page gets the keys typing sends (suggestions, checks as one types). A text over 300 characters (a pasted paragraph)
is filled at once (`TYPED_MAX`, `main/tools/browser.ts`). Letters not on a US keyboard come as typed text, without key codes
(Playwright's way).

The agent learns how to work with tasks, browser profiles and Stage terminals from the Kulisa plugin: the Kulisa skill (`resources/skills/kulisa/SKILL.md`; keep it in step with the tools), one text for every agent,
written into each account's folder where its agent reads its skills (`kulisa`). Installation keeps one generated
skill copy in that account. The skill and MCP instructions leave the final app ready for human review and close
only temporary testing environments. Claude Code also gets a plugin
with the MCP config (`resources/claude-plugin/`, `claude --plugin-dir`). Every agent gets Kulisa's hooks at its start (a table in
its file, `agents/`), among them `SessionStart`, which tells the agent which profiles are open and tells Kulisa its
session (to resume it). The user's own MCP servers stay available
(no `--strict-mcp-config`). Some of them may drive another browser with tools of the same names (cast's,
Playwright MCP's `browser_click` …), and an agent has no priority among MCP servers: it chooses by names and
descriptions. So every agent is told, in the MCP server's `instructions` and again at the session's start next to the
profiles (`ONLY_BROWSER`, `agent-hooks.ts`), that the profiles are the only browser here, and why: another browser is
not the one the human sees, and not signed in. Not blocked (`--disallowedTools` would need every such server's name,
and would refuse it also when the human asks for it). Codex gets the MCP server and the hooks as config overrides (its `SessionStart` brings the open profiles).

The human sees what the agent does (`ghost.ts`): Playwright's action annotations in the page, each shown 500 ms,
which every action waits for (so it is kept short: a longer one adds up over an agent's clicks): a mark at the action
point, the element outlined, and the agent's own pointer, moving from one action to the next and staying at the last
(Playwright's `cursor: 'pointer'`; not the OS's: the human's mouse stays theirs; no test of its pixels, Playwright
draws it); and a caption over the pane for every command through the proxy. The marks and
`browser_highlight`'s outlines are in Kulisa's accent in every profile (`MARK`): the pane says whose page it is.

## Agent adapters

- **Install** (Settings → Agents) runs the maker's own native installer (no Node, no sudo, they update themselves),
  the command shown before, its output streamed while it runs, so people who are not programmers type nothing; once
  over, the answer brings the whole output (Electron keeps no order between the stream's channel and the answer's: the
  last line may come after "Installed"). Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex `curl
  -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows). On Windows the installer gets the
  system's own programs first in its `PATH`: they call `tar` by name, and Kulisa started from Git Bash has Git's GNU
  tar first, which reads `C:\…` as a remote host. Kulisa does not remove or update agents: they are the user's
  programs.
- Each agent is one entry in `agents/`: how to find, install, start (Claude Code with the Kulisa plugin; Codex with
  the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume (`claude
  --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume --last`) and
  forget a deleted task's folder.
- **Dictation** ([dictation](../dictation/README.md)): where the agent has its own (its entry's `voice`: its
  key and how often it is typed; Claude Code's voice mode, which needs a Claude.ai account), Kulisa holds its key; for
  one without (Codex has only a realtime voice conversation), another agent's dictation recognizes in a session no one
  sees (its entry's `recognizer`: Claude Code's, in hold mode with `autoSubmit`, its text posted by its
  `UserPromptSubmit` hook and blocked there). Kulisa turns it on for its own sessions (Claude Code: `--settings` with
  `voice: { enabled, mode: "hold", autoSubmit: false }`, not the user's settings). Not `tap` mode: it records only with
  the input empty, so no second sentence can be added.
- **Language**, where the agent has a setting (its entry's `language`: the codes it takes, and how one is written into
  an account's folder): Kulisa's one language (☰ → Language, [window.md](../../docs/window.md), Language) goes into every
  account. Claude Code's is its `language` setting, which it dictates and answers in, written where its `/config`
  puts it (`<config dir>/settings.json`, the language's English name), the rest of the file kept, not written when it
  says so already, never into a file that is not JSON. Claude Code reads that file again when it changes, so it holds
  at once in every session; a `--settings` file would not (read once).
## Hooks

- **An agent's state on the tabs** comes from its hooks, each agent's at its own terminal's URL ("Several agents in a
  task"). Kulisa's events (`agent-hooks.ts`): `prompt` working, `waiting` for the human, `tool-done` working again
  after waiting, `stop` done, `interrupt` and `session-end` unknown (a session ending after a done turn keeps done).
  No agent tells when the human answered a permission, so the first tool to finish after it (`PostToolUse`) is the
  sign it works again. Which hook sends which is a table in the agent's file (`agents/claude.ts`, `codex.ts`:
  `hooks`), each running one command (`hookCommand`, `agents/agent.ts`):
  - Claude Code, in `--settings` with its plugin: `UserPromptSubmit`, `Stop`, waiting when it asks for a permission
    or a question (`Notification` matched to `permission_prompt`, `elicitation_*`) or a turn ends with an API error
    (`StopFailure`: a limit, a sign-in); `PostToolUse`; `SessionEnd` (`/exit`, `/clear`). Not `idle_prompt`, sent a
    minute after an answer. The core reports an Esc typed into an agent's terminal as an interrupt (`Task.interrupted`).
  - Codex, as a config override (`-c hooks=…`): `UserPromptSubmit`, `PermissionRequest` waiting (its MCP tools'
    questions too), `PostToolUse`, `Stop`, `Interrupt` (Esc), `SessionEnd` (also after 30 minutes idle), and
    `SessionStart`, which gives it the open profiles as Claude Code gets them and the session to resume. Codex runs a
    hook only once the human has trusted it (`/hooks`), kept per event under one key for every task
    (`/<session-flags>/config.toml:<event>`), so once is enough, and again only when Kulisa changes a hook. Kulisa
    never bypasses that, which would run any project's hooks unreviewed too. Interrupt's and SessionEnd's timeouts
    are at most 3 s (Codex cuts a longer one and warns at every start).

## Task history

Stage arrangements use the caller’s task action through `stage_arrange` (`tools/task.ts`); the human’s stage menu calls the same action.

**`task_history(conversation, part)`**, a tool of Kulisa's MCP server (`tools/task.ts`, `history.ts`), gives a text
in parts of about 40,000 characters (10,000 tokens: under what agents take from one tool's result). Part 1 says how
many there are. The whole text is made at part 1 and kept in memory with the task, so the next parts stay the same
while the agent's own transcript grows.

- **Without a conversation**: **where the task stands** (Kulisa's part, what no transcript says): the task, its
  folder and branch; for each copy of the code, its commits since the task started, the files not committed and
  `diff --stat` against its start (`progress` in `worktrees.ts`); the profiles open and closed; the shells and what
  runs there. Then **its conversations**, oldest first, numbered from 1 (each an agent's, `agent.json`: tasks.md,
  "Several agents in a task"): its tab's name (the one its agent gave it), its agent and account, open in its tab or
  closed, from when to when, the human's first and last request in it (200 characters at most), and how its last turn
  ended (a tool call with no result: cut off, by a limit or the human; or the human's last message with no answer).
- **With a conversation's number**: that conversation whole, the latest chapter first. It is cut into **chapters**
  at its agent's compaction summaries: a chapter is a summary and what follows it up to the next, given from the
  latest back. At the end of its last chapter: how its last turn ended, the agent's last plan (`TodoWrite`) and what
  it remembered in the task's folder (Claude Code's memory).

Why so:

- **Nothing kept by Kulisa.** The history is read from the agent's own transcript at the call. A copy kept after
  each turn adds code and no record; notes the agent writes through a tool cost tokens and depend on the model
  remembering them.
- **A tool, not a file.** The task's data folder holds its profiles' cookies, so no agent gets it; a file in the
  worktree is in the human's code; and every CLI reads a tool's result, Codex in its sandbox too.
- **The whole conversation, lightly cut**, not a summary: a summary loses the details spread through it, and the
  next agent, a model of the same class, finds what matters better than rules do. The rules only take away what is
  of no use to anyone.
- **The latest chapter first.** A compaction summary is the agent's own handoff to itself, and after it the agent
  works from that summary and what follows alone: the latest chapter is the state it was in when it stopped. The
  earlier ones are where a summary's omission is found; the agent is told to read every part.
- **A list first, then one conversation**: with several agents in a task, only the one asked for is read.
- **Useful beyond a handoff**: an agent whose context was compacted reads the details again.

The agent learns of it from the MCP server's instructions (every agent) and the Kulisa plugin's skill (Claude Code).

## Claude Code's transcript

`<config folder>/projects/<task folder with / and other characters as ->/<session>.jsonl`: a JSON record per line;
`type` at its top; `user` and `assistant` records with `message.content`, a string or an array of blocks each with
its own `type`; `uuid`, `parentUuid`, `timestamp` on each; a tool call's `id` (`toolu_…`) is its result's
`tool_use_id`. Large tool outputs are kept apart in `<session>/tool-results/`, with a reference in the transcript.

The reader (`claudeConversation`, `agents/claude.ts`, its entry's `conversation`), record by
record:

| Record | Known by | Text from | Kept as |
|---|---|---|---|
| the human's message | `type: "user"`, `message.content` a string (or `text` blocks), neither `isMeta` nor `isCompactSummary` | `message.content` | whole |
| the human's message typed while the agent worked (queued, sent at its next step) | `type: "attachment"`, `attachment.type: "queued_command"`, `attachment.origin.kind: "human"` | `attachment.prompt` (a string, or text blocks) | whole: dropping attachments wholesale would lose them |
| a background task's notice | `queued_command` with `origin.kind: "task-notification"` | | left out |
| a hook's or skill's text, not the human's | `type: "user"`, `isMeta: true` | | left out |
| a compaction summary ("This session is being continued from a previous conversation…") | `type: "user"`, `isCompactSummary: true` | `message.content` | whole; a chapter starts there |
| the agent's answer | `type: "assistant"`, block `type: "text"` | `.text` | whole |
| a tool call | `type: "assistant"`, block `type: "tool_use"`: `name`, `input` | `Bash`: `input.command`; `Edit`: `file_path`, `old_string`, `new_string`; `Write`: `file_path`, `content`; `Read`: `file_path` alone; any other (Kulisa's `mcp__kulisa__*` too): `name` and `input` as JSON | whole: the command run, the file edited and how |
| a tool's result | `type: "user"`, block `type: "tool_result"`: `tool_use_id`, `is_error`, `content` (a string, or `text` blocks); beside it `toolUseResult` (Bash: `stdout`, `stderr`, `interrupted`), not read | `content` | its first and last 2 KB (`CUT`), `… [N characters cut] …` between; whole when `is_error`; a `Read`'s left out (its path is in the call: the file is in the task's folder, and may have changed) |
| the agent's plan | a `tool_use` named `TodoWrite`, `input.todos` (`content`, `status`) | the last one | at its conversation's end (not a sure source: a session may have none) |
| `task_history`'s own calls and results | a `tool_use` named `mcp__kulisa__task_history`, its result | | left out: the conversations it gave are read from their own transcripts |
| reasoning | block `type: "thinking"` (`thinking`, `signature`: signed, another model cannot take it; empty in most records) | | left out |
| an image | block `type: "image"` (`source.data`) | | left out |
| a hook's output (`SessionStart`'s context among them) | `type: "attachment"`, `attachment.type: "hook_success"` | | left out |
| the CLI's own records | `type: "attachment"` of any other `attachment.type` (`total_tokens_reminder`, `deferred_tools_record`, `environment`, `edited_text_file`, `file`, …); `type` of `system`, `mode`, `permission-mode`, `last-prompt`, `atis-latch`, `ai-title`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `cost-state`, `continued-in` | | left out |

A record of a kind the reader does not know is skipped, and a line that is not JSON too, so a new kind in a new
version loses nothing else; the unit test, on a transcript in this format, catches a renamed one. The cut's size is one
constant, to be tuned on real handoffs.

**The conversation's name**: Claude Code's own auto-title, read by the entry's `title` (`claudeTitle`): the last
non-empty `aiTitle` of the `ai-title` records in the transcript's last MB, read without blocking (it writes one again
every few records, and a transcript runs to hundreds of MB; none there keeps the title read before). It is read at a session's start
and at a turn's end, then again 5, 15 and 30 s later until it changes (`Task.followAutoTitle`): an agent may name the
session only once its turn is over. It names the conversation's tab, and the task's while the task is unnamed, until a name is given
explicitly (`conversation_rename`, `task_rename`; [tasks.md](../../docs/tasks.md)). A name derived from the folder (Claude Code's
sessions file, `nameSource: "derived"`) is not a title and is not read. A unit test catches the field being renamed.

**What it remembered**: Claude Code's memory of a folder, `projects/<folder>/memory/` (`MEMORY.md`, its index, and a
file per fact); the reader gives it, the index first.

## Codex's transcript

`<CODEX_HOME>/sessions/<yyyy>/<mm>/<dd>/rollout-<time>-<session>.jsonl`: a JSON record per line, `{ timestamp, type,
payload }`. The model's own items are `response_item`s; `event_msg`s repeat them for its screen, with its turns'
starts, ends and interruptions. Codex calls tools from scripts: `exec`, a custom tool whose `input` is JavaScript
calling `tools.<name>(…)` (Kulisa's as `tools.mcp__kulisa__<name>`), its output what the script printed.

The reader (`codexConversation`, `agents/codex.ts`), record by record:

| Record | Known by | Text from | Kept as |
|---|---|---|---|
| the human's message | `response_item`, `payload.type: "message"`, `role: "user"` | its `input_text` blocks | whole; queued ones (typed while it works) come the same way |
| Codex's own context as the user's | a user message starting `<environment_context>`, `<user_instructions>`, `<turn_aborted>` or `# AGENTS.md instructions` | | left out |
| its instructions (Kulisa's among them) | `role: "developer"` | | left out |
| the agent's answer | `role: "assistant"` | its `output_text` blocks | whole |
| a call | `payload.type: "custom_tool_call"` (`exec`, `apply_patch`: `name`, `input`) or `"function_call"` (`wait` …: `name`, `arguments`); `call_id` | `<name>: <input or arguments>` | whole: the script, the patch |
| its result | `custom_tool_call_output` or `function_call_output` with the same `call_id`; `output` a string or `input_text` blocks | `output` | its first and last 2 KB (`CUT`); Codex marks no error apart |
| `task_history`'s own calls | an `exec` whose `tools.` calls are all `task_history` (or that only looks it up), and its output | | left out |
| the agent's plan | a `function_call` named `update_plan`, `arguments.plan` (`step`, `status`) | the last one | at its conversation's end (from Codex's tool's shape) |
| a compaction | `type: "compacted"`: `replacement_history`, the human's messages and a `compaction` item with `encrypted_content` | | a chapter starts there, its summary said to be unreadable: Codex encrypts it |
| an interruption (Esc) | `event_msg`, `payload.type: "turn_aborted"` | | where its last turn ended, when after the human's last message |
| reasoning | `payload.type: "reasoning"` (`encrypted_content`) | | left out |
| the rest | `session_meta`, `turn_context`, `world_state`, `token_usage_record`, every other `event_msg` (`item_completed`, with `McpToolCall`s, repeats what the scripts printed) | | left out |

No memory: Codex keeps its own in a database of its format (`memories_*.sqlite`).

**The conversation's name** (`codexTitle`): not in the transcript, but in `session_index.jsonl` of its `CODEX_HOME`
(the folder holding the transcript's `sessions/`): a line `{ id, thread_name, updated_at }` appended each time Codex
names a session, a title it generates seconds after a turn is over, or `/rename`; the session's last line wins, found
by the session id its SessionStart hook reported (none without its hooks: then no title). Used as Claude Code's is
(above); a unit test on an index made here in its format.

## Tool design

### Principles

1. **The reader is the agent.** A tool's `registerTool` description is its documentation and the one source: what it
   does, when to use it, what it costs. The skill says how the tools fit together (the order, the rules, when to use
   which) and never lists them.
2. **As the root `AGENTS.md` holds for all of Kulisa**: the same tools for every agent (what only one has is an extra
   in its file in `agents/`); one core, a thin handle (the action, its checks and rules are `Task`'s or `Profile`'s;
   the human gets it in the window too); tools, not the work's logic (a tool that cannot act says what is missing).
3. **An action with a meaning, not an API's wrapper.** A tool is named and shaped by what the agent wants ("the
   failed requests to /api"), not by the library call under it. Its parameters let the agent narrow what it gets (a
   filter, a part, a period); the defaults are what most calls need.
4. **The human sees, and stays in charge.** What the agent does shows in the page; the human's tabs stay as they
   were; the sign-in pause holds (automation reaches pages only through the CDP proxy); Kulisa never hands the agent a
   password (`browser_type_login` types it) or a cookie or token (`browser_network_request` hides them). What a script
   of the agent reads in a page is the agent's: Kulisa does not restrict it ([profiles.md](../../docs/profiles.md)).
5. **A missing tool shows itself.** The agent going around the tools (a Playwright script of its own, `curl`, asking
   the human to click) names a tool to build; so do the users' Ideas for Kulisa (issue #84).

### What a tool must be

A new tool, or a change to one, meets all of these:

- **Useful.** It does what the agent needs and cannot do as well with the tools there, and does it whole: no half
  result the agent must patch up with more calls.
- **Economical with the agent's context**: how, below.
- **Bounded.** Every wait has a timeout, every list a limit: a tool never holds the agent's turn.
- **Fast.** One call where the agent would need several (`browser_snapshot`'s `also`: several profiles at once); no
  work the answer does not need.
- **Light on the computer.** No process or buffer kept for it beyond its call. The only files it may keep are those
  "Large goes to disk" describes, and they go with their task (the root `AGENTS.md`: "RAM matters", "Nothing piles
  up").
- **Clear when it fails.** The error says what is wrong and what to do: which profiles there are, that the human is
  signing in.
- **Safe.** It acts within its task only. Core ownership and checks apply to both window and agent actions;
  where it changes real accounts, Kulisa asks the human.
- **Tested.** Its behavior has a test ([testing.md](../../docs/testing.md)). Its log line needs no code: `registerTool` writes it.

### Saving the agent's context

The agent's context holds the code and its reasoning too: every token a tool puts there is one less for thinking.

1. **Narrow, don't dump.** Where playwright-core gives a lot (a page's requests, its console, its snapshot), the tool
   wraps it with filters, so the agent takes only what it needs: requests by address and without static files, the
   console by level, a snapshot of one element or to a depth. Playwright MCP's and Chrome DevTools MCP's ways
   are worth a look, taken on their merits.
2. **A part, not the whole.** A screenshot of an element or a region, not of the page; a snapshot of a subtree, not
   of the document.
3. **Large goes to disk.** A snapshot or a response's body over a limit is written to a file in the task's artifacts
   (`artifacts.ts`; never the project's folder: nothing of Kulisa's in the agent's `git status`), each its own, never
   replaced (two to compare), the oldest gone past a limit; a screenshot is kept there too. The answer gives its path
   and a short outline, and the agent reads the part it needs.
4. **A signal before the content.** An action's answer carries counts (2 console errors, 1 failed request), so the
   agent reads the details only when there are some.
5. **An action answers in a line**: what was done and where the page is now. A snapshot only when asked for.
6. **Text before pictures.** A picture costs the most: a screenshot only when the look matters, scaled down, as JPEG.
7. **Saving never takes a capability away.** The defaults give little; a parameter always gives all, so the agent
   never meets a wall where what it needs cannot be had.

## The code

| Part | What |
|---|---|
| `main/index.ts`, `main/core.ts` | the entry and caller contracts |
| `main/mcp-server.ts`, `main/agent-hooks.ts` | transport, instructions and hooks |
| `main/tools/` | browser, profile, task and terminal tools; shared argument and locator handling |
| `main/ghost.ts` | annotations and captions of automated actions |
| `main/agents/` | one adapter per CLI, discovery, configuration and agent-file helpers |
| `main/history.ts`, `main/transcripts.ts` | history formatting and shared transcript records |
| `resources/` | shared skills and CLI-specific plugin resources |
| `agents.test.ts`, `transcripts.test.ts` | agent integration and transcript records, plain Node |

End-to-end coverage: `test/e2e/agent-*.spec.ts`, `agents-in-a-task.spec.ts`, `tasks*.spec.ts`,
`terminals*.spec.ts`, `dictation.spec.ts`, `zoom-and-closing.spec.ts`; fixtures in `app.ts` and `driver.ts`.

### Outside this Kulisa package

| File | Why it stays outside |
|---|---|
| `src/main/plugin.ts` | implements the contracts from core objects, native browser events, git and task records |
| `src/main/app.ts` | starts the MCP server and annotations, locates packaged resources, supplies the available agents |
| `src/main/tasks.ts` | owns terminal sessions, profiles, conversations and the task's files; invokes adapter operations |
| `src/main/accounts.ts`, `shell.ts` | own account records and the application's agent choices |
| `src/main/ipc/agents.ts` | supplies the window's agent/account actions and discovery cache |
| `src/main/recognizer.ts` | chooses an account for the dictation Kulisa package |
| `forge.config.ts`, `scripts/version.ts` | build resources and synchronize the app's version |
| `.dependency-cruiser.ts` | enforces entries, core independence and runtime cycles |
| `test/unit/accounts.test.ts`, `forge.test.ts` | core account ownership and packaging contracts |
| `test/e2e/` | exercises the running app through MCP and the window |
