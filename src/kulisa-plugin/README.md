# Kulisa plugin

Agent CLI integration: MCP tools, hooks, shared instructions, adapters and transcripts, a
[Kulisa package](../../docs/packages.md). Callers implement `main/core.ts` contracts; the package imports no core
domain implementations/types and owns no tasks, profiles, accounts or terminals.

## Boundary

Entry: `main/index.ts`. Allowed infrastructure supplies logging, atomic writes and Windows-safe removal; other
Kulisa packages are reached through entries. `PluginHost` supplies admission, context, lifecycle, captions and task
lookup; `TaskAccess`/`ProfileAccess`/`TabAccess`/`TerminalAccess` expose live facts/actions.

Core owns checks, questions, ownership and platform objects. The plugin owns tool behavior/instructions, sign-in
waiting, highlights/annotations and transcript formatting. Playwright reaches pages through the supplied CDP proxy.
`environmentUsed` reports browser/named terminal activity; the window owns Follow agent.

`resources/` holds the shared skill and Claude plugin (`claude-plugin/.claude-plugin/`, manifest `kulisa`). Forge
copies resources beside, not inside, the archive. `scripts/version.ts` synchronizes manifest version at `npm version`.
Codex receives the same MCP service through launch configuration.

## MCP transport

Streamable HTTP on `127.0.0.1` only, admitted by the caller's local-only request check. Each task has
`/task/<project>/<task>/mcp`, each terminal `/task/<project>/<task>/t/<id>/mcp`; project and task identifiers are
percent-encoded. A server and transport per request close with the response. Task access is cached weakly by the
caller so history parts share one identity across requests and disappear with their task.

## Browser tools

Tool descriptions in `registerTool` define inputs/behavior. Handles resolve profile names with `Task.named` and
optional tabs. Kulisa sessions approve all tools, including command/terminal/file-upload actions, through scoped
Claude `--settings` server permissions or Codex `default_tools_approval_mode="approve"`. Core actions still ask
where required; tools do not ask at each click.

- Choose profiles by human descriptions, not inferred names. Ask once when ambiguous and save with
  `profile_describe`; MCP instructions include the same rule for agents without the skill.
- `browser_wait_for` supports cross-profile effects, bounded to 45 s; snapshot `also` compares active tabs.
- Action dialogs accept `dialog: accept`; otherwise dismiss/report. Existing human dialogs fail promptly.
- `profile_ask_signin` optionally navigates through core, shows the request and waits up to 45 s. Keep request
  location for 10 minutes across calls; completion is sign-in-mode exit or origin/path change. Same-URL in-page
  login needs human confirmation. Real-account credentials remain human-owned.
- `browser_evaluate` creates/calls source in the page, optionally with an element, never main-process eval.
  Page access is not sandboxed; local-process CDP authentication is #90.
- Snapshots support subtree refs/locators, depth and find-with-ancestors. Large results (~10k tokens) spill to
  bounded task artifacts with path/top outline; screenshots also persist. Claude settings allow artifact reads.
- Playwright supplies recent console/errors/requests (200/200/100). Filter level/address/static files; stable request
  numbers address detail reads. Hide credential/cookie headers; spill large bodies. Action results count new errors
  and failed requests; `since: action` narrows detail. Pending requests never block a result.
- `browser_highlight` follows elements via `locator.highlight()`, including Trusted Types; header labels remain until
  human input. `browser_type` uses `pressSequentially` at 40 ms/key, faster for long text (about 1.5 s cap), and fill
  beyond `TYPED_MAX` 300 characters. Non-US characters use Playwright's text input.

Install one generated shared skill per account. It teaches profiles/tasks/Stage and leaving the final app ready;
Claude also loads `--plugin-dir`, Codex uses config overrides. `SessionStart` supplies open profiles/session IDs.
Keep the user's other MCP servers enabled; `ONLY_BROWSER` instructions identify Kulisa profiles as the browser the
human sees without blocking explicitly requested alternatives.

`ghost.ts` draws accent action outlines/pointer for 500 ms, awaited per action, plus proxy captions. The human's OS
pointer remains independent; pane identity distinguishes profiles. Keep skill and MCP instructions aligned.

## Agent adapters

Each `agents/<cli>.ts` owns discovery, installation, launch, resume, hooks, capabilities and folder cleanup.

- Settings Install shows/runs the maker's native installer and streams output; include full output in the result
  because IPC stream/result ordering is not guaranteed. Claude/Codex use official install scripts, PowerShell on
  Windows. Prioritize system PATH over Git Bash's tar on Windows. Installed CLIs remain user-owned and self-update.
- Claude launches with plugin/settings, Codex MCP/hooks as config overrides. Resume with reported session ID;
  Codex can fall back to `resume --last`.
- `voice` config describes native hold/repeat behavior; `recognizer` describes hidden dictation/hook blocking
  ([dictation](../dictation/README.md)). Claude Kulisa sessions enable hold mode with `autoSubmit: false`; hidden
  recognizers enable it. Tap mode prevents appending a second sentence to existing input.
- `language` maps Kulisa's language to account configuration. Claude writes English language names into
  `settings.json`, preserves other JSON fields, skips unchanged values and refuses non-JSON. The CLI rereads it live;
  launch `--settings` alone would not update running sessions.

## Hooks

Each terminal's hooks report state through its own URL. `prompt` → working, `waiting` → human input,
`tool-done` → working after waiting, `stop` → done, interrupt/session-end → unknown unless already done. A completed
tool is the available signal that a permission was answered. Adapter tables map CLI events through `hookCommand`:

- Claude: UserPromptSubmit, Stop, PostToolUse, SessionEnd, permission/elicitation Notifications and StopFailure
  (limits/auth/errors). Ignore delayed idle_prompt; core terminal Esc reports interrupt.
- Codex: UserPromptSubmit, PermissionRequest, PostToolUse, Stop, Interrupt, SessionEnd and SessionStart. Trust is
  human-approved once per event/config key, repeated only when hooks change; never bypass it. Interrupt/SessionEnd
  timeout is at most 3 s. SessionEnd can also mean idle expiry.

## Task history

`stage_arrange` calls the same task action as the human Stage menu.

`task_history(conversation, part)` returns ~40,000-character parts. Part 1 materializes a task-owned in-memory
snapshot and reports part count so later parts stay stable as native transcripts grow.

- No conversation number: folder/branch, resource progress since task start (commits, dirty files, diff stat),
  profiles and shells, then conversations oldest first. List names, account/agent, open/closed state, times, first/
  last human request (200 characters) and how the last turn ended.
- Conversation number: complete lightly cut transcript, newest chapter first. Compaction summaries start chapters;
  final metadata includes turn status, last plan and readable memory.

Read native transcripts on demand rather than duplicating history or adding agent-written notes. Tools work across
CLIs/sandboxes without exposing profile data directories or writing into project code. Whole conversations preserve
handoff details; latest-first chapters provide current state, earlier chapters recover omissions. Teach agents to
read all parts through MCP instructions and the shared skill.

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

- Tool descriptions are the API documentation; skills explain workflow without duplicating the catalog.
- Follow root architecture: same tools across agents, core actions/checks, thin handles, no agent workflow in core.
- Name/shape tools by the agent's goal, not a library call. Offer useful filters/defaults.
- Preserve human tabs and visible actions through the proxy/sign-in pause. Never return saved passwords,
  credential headers or tokens; arbitrary agent page scripts remain outside that guarantee.
- Treat workarounds using scripts/manual clicks as evidence of missing capabilities; issue #84 covers user reports.

### What a tool must be

- Complete a useful action without redundant calls; batch related reads when appropriate.
- Bound waits/lists and minimize context, retained memory and processes. Persist only bounded task-owned artifacts.
- Fail with target/state and a next step; enforce task ownership through core and required human confirmations.
- Test behavior ([testing.md](../../docs/testing.md)); `registerTool` supplies action logging.

### Saving the agent's context

- Filter console/requests/snapshots; prefer subtree or element reads over whole pages.
- Spill oversized snapshots/bodies to unique bounded task artifacts, never project files; return path/outline.
- Action replies give a short result and error counts; fetch details/snapshots only when requested.
- Use JPEG screenshots when appearance matters; text is cheaper for structure/state.
- Small defaults must retain parameters for complete access.

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
