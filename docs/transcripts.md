# The task's history and the agents' transcripts

How an agent reads what was said and done in its task, by itself or by other agents (`task_history`), and how Kulisa
reads each agent CLI's transcript for it. Built 2026-10-12 for handing a task from one agent to another
([tasks.md](tasks.md), "Several agents in a task"). Keep this file current when a reader changes, and check it when an agent CLI is updated:
the transcripts' formats are the agents' own and undocumented.

## What the agent gets

**`task_history(conversation, part)`**, a tool of Kulisa's MCP server (`mcp-server.ts`, `history.ts`), gives a text
in parts of about 40,000 characters (10,000 tokens: under what agents take from one tool's result). Part 1 says how
many there are; the agent calls the next ones in turn. The whole text is made at part 1 and kept (in memory, with the
task) for the next parts, so they stay the same while the agent reads them: its own transcript grows meanwhile.

- **Without a conversation**: **where the task stands** (Kulisa's part, what no transcript says): the task, its
  folder and branch; for each copy of the code, its commits since the task started, the files not committed and
  `diff --stat` against its start (`progress` in `worktrees.ts`); the profiles open and closed; the shells and what
  runs there. Then **its conversations**, oldest first, numbered from 1 (each an agent's, `agent.json`: tasks.md,
  "Several agents in a task"): its tab's name (the one its agent gave it), its agent and account, open in its tab or
  closed, from when to when, the human's first and last request in it (200 characters at most), and how its last turn
  ended (a tool call with no result: cut off, by a limit or the human; or the human's last message with no answer).
  The agent finds there the conversation the human points it to ("what Claude did", "the checkout").
- **With a conversation's number**: that conversation whole, the latest chapter first. It is cut into **chapters**
  at its agent's compaction summaries: a chapter is a summary and what follows it up to the next, given from the
  latest back. At the end of its last chapter: how its last turn ended, the agent's last plan (`TodoWrite`) and what
  it remembered in the task's folder (Claude Code's memory).

Why so:

- **Nothing kept by Kulisa.** The agent's transcript is on disk already, written by the agent; the history is read
  from it at the call. A copy kept as the work goes (after each turn), or notes the agent writes through a tool, were
  weighed and not chosen: a copy adds code and no record, and notes cost tokens and depend on the model remembering
  to write them (2026-10-12).
- **A tool, not a file.** The task's data folder holds its profiles' cookies, so no agent gets it; a file in the
  worktree is in the human's code; and every CLI reads a tool's result, Codex in its sandbox too.
- **The whole conversation, lightly cut**, not a summary of it (the author, 2026-10-12: details that matter are
  spread through a long conversation, and a summary loses them). The next agent, a model of the same class, finds
  what matters better than rules do; the rules only take away what is of no use to anyone.
- **The latest chapter first.** A compaction summary is the agent's own handoff to itself, written while it had
  budget and the details before it (what was asked, the decisions, the technical findings, the files), and after a
  compaction the agent worked from that summary and what followed alone. So the latest chapter is the state the
  agent was in when it stopped; the earlier ones are where a summary's omission is found, and the agent is told to
  read every part.
- **A list first, then one conversation** (the author, 2026-10-12): with several agents in a task, the one asked for is
  read, not all of them.
- **Useful beyond a handoff**: an agent whose context was compacted reads the details again.

The agent learns of it from the MCP server's instructions (every agent) and the Kulisa plugin's skill (Claude Code).

## Claude Code's transcript

`<config folder>/projects/<task folder with / and other characters as ->/<session>.jsonl`: a JSON record per line;
`type` at its top; `user` and `assistant` records with `message.content`, a string or an array of blocks each with
its own `type`; `uuid`, `parentUuid`, `timestamp` on each; a tool call's `id` (`toolu_…`) is its result's
`tool_use_id`. Large tool outputs are kept apart in `<session>/tool-results/`, with a reference in the transcript.
Checked with Claude Code 2.1.296, on a session of the author's (56.7 MB, 14,529 records, 9 compaction summaries).

The reader (`claudeConversation`, `agents/claude.ts`, its entry's `conversation`), record by
record:

| Record | Known by | Text from | Kept as |
|---|---|---|---|
| the human's message | `type: "user"`, `message.content` a string (or `text` blocks), neither `isMeta` nor `isCompactSummary` | `message.content` | whole |
| the human's message typed while the agent worked (queued, sent at its next step) | `type: "attachment"`, `attachment.type: "queued_command"`, `attachment.origin.kind: "human"` | `attachment.prompt` (a string, or text blocks) | whole: dropping attachments wholesale would lose them (21 in the session checked) |
| a background task's notice | `queued_command` with `origin.kind: "task-notification"` | | left out (97 there) |
| a hook's or skill's text, not the human's | `type: "user"`, `isMeta: true` | | left out |
| a compaction summary ("This session is being continued from a previous conversation…") | `type: "user"`, `isCompactSummary: true` | `message.content` | whole; a chapter starts there |
| the agent's answer | `type: "assistant"`, block `type: "text"` | `.text` | whole |
| a tool call | `type: "assistant"`, block `type: "tool_use"`: `name`, `input` | `Bash`: `input.command`; `Edit`: `file_path`, `old_string`, `new_string`; `Write`: `file_path`, `content`; `Read`: `file_path` alone; any other (Kulisa's `mcp__kulisa__*` too): `name` and `input` as JSON | whole: the command run, the file edited and how |
| a tool's result | `type: "user"`, block `type: "tool_result"`: `tool_use_id`, `is_error`, `content` (a string, or `text` blocks); beside it `toolUseResult` (Bash: `stdout`, `stderr`, `interrupted`), not read | `content` | its first and last 2 KB (`CUT`), `… [N characters cut] …` between; whole when `is_error`; a `Read`'s left out (its path is in the call: the file is in the task's folder, and may have changed) |
| the agent's plan | a `tool_use` named `TodoWrite`, `input.todos` (`content`, `status`) | the last one | at its conversation's end (the session checked had none: not a sure source) |
| `task_history`'s own calls and results | a `tool_use` named `mcp__kulisa__task_history`, its result | | left out: the conversations it gave are read from their own transcripts |
| reasoning | block `type: "thinking"` (`thinking`, `signature`: signed, another model cannot take it; empty in most records) | | left out |
| an image | block `type: "image"` (`source.data`) | | left out |
| a hook's output (`SessionStart`'s context among them) | `type: "attachment"`, `attachment.type: "hook_success"` | | left out |
| the CLI's own records | `type: "attachment"` of any other `attachment.type` (`total_tokens_reminder`, `deferred_tools_record`, `environment`, `edited_text_file`, `file`, …); `type` of `system`, `mode`, `permission-mode`, `last-prompt`, `atis-latch`, `ai-title`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `cost-state`, `continued-in` | | left out |

A record of a kind the reader does not know is skipped, and a line that is not JSON too, so a new kind in a new
version loses nothing else; the unit test, on a transcript in this format made by the test, catches a renamed one.

Measured on that session (300 ms): 3.6 MB of text (418 of the human's messages, 675 answers, 1,727 calls, 1,569
results cut, 32 errors whole, 9 summaries; left out: 1,498 reasoning blocks, 126 files read, about 8,000 of the CLI's
own records), in 10 chapters (704, 498, 301, 326, 393, 185, 523, 328, 325 and 20 KB). The cut's size is one constant,
to be tuned on real handoffs.

**What it remembered**: Claude Code's memory of a folder is next to its transcripts, `projects/<folder>/memory/`
(`MEMORY.md`, its index, and a file per fact), written by the model while it had budget; the reader gives it, the
index first.

## Codex's transcript

`<CODEX_HOME>/sessions/<yyyy>/<mm>/<dd>/rollout-<time>-<session>.jsonl`: a JSON record per line, `{ timestamp, type,
payload }`. The model's own items are `response_item`s; `event_msg`s repeat them for its screen, with its turns'
starts, ends and interruptions. Codex calls tools from scripts: `exec`, a custom tool whose `input` is JavaScript
calling `tools.<name>(…)` (Kulisa's as `tools.mcp__kulisa__<name>`), its output what the script printed. Checked with
Codex 0.160.1, on a session made for it in a scratch Kulisa (2026-10-12: browser tools, `terminal_run`, an Esc, a
`/compact`).

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
| the agent's plan | a `function_call` named `update_plan`, `arguments.plan` (`step`, `status`) | the last one | at its conversation's end (not seen in the session checked: from Codex's tool's shape) |
| a compaction | `type: "compacted"`: `replacement_history`, the human's messages and a `compaction` item with `encrypted_content` | | a chapter starts there, its summary said to be unreadable: Codex encrypts it (claude-codex-bridge found it first) |
| an interruption (Esc) | `event_msg`, `payload.type: "turn_aborted"` | | where its last turn ended, when after the human's last message |
| reasoning | `payload.type: "reasoning"` (`encrypted_content`) | | left out |
| the rest | `session_meta`, `turn_context`, `world_state`, `token_usage_record`, every other `event_msg` (`item_completed`, with `McpToolCall`s, repeats what the scripts printed) | | left out |

No memory: Codex keeps its own in a database of its format (`memories_*.sqlite`).

## The code

| File | What |
|---|---|
| `src/main/kulisa-plugin/history.ts` | the history's text: Kulisa's part, the conversations listed, one's chapters, the parts |
| `src/main/kulisa-plugin/transcripts.ts` | the entries a transcript is read as (`human`, `agent`, `call`, `result`, `error`, `summary`), its plan, where it stopped, its memory; what is cut |
| `src/main/agents/claude.ts`, `codex.ts` | each agent's reader (`claudeConversation`, `codexConversation`), its entry's `conversation` |
| `src/main/worktrees.ts` | `progress`: a copy's commits, files not committed, `diff --stat` |
| `src/main/kulisa-plugin/mcp-server.ts` | the `task_history` tool, and a sentence of the instructions |
| `test/unit/transcripts.test.ts`, `test/agent.ts` | the tests: the reader record by record; the tool's order and parts |
