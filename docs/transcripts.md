# The task's history and the agents' transcripts

How an agent reads what was said and done in its task before it, by itself or by another agent (`task_history`), and
how Kulisa reads each agent CLI's transcript for it. Built 2026-10-12 for switching a task's agent
([tasks.md](tasks.md), "Switching the agent"; what is left, Codex's reader: [ROADMAP.md](ROADMAP.md)). Keep this file current when a reader changes, and check it when an agent CLI is updated:
the transcripts' formats are the agents' own and undocumented.

## What the agent gets

**`task_history(part)`**, a tool of Kulisa's MCP server (`mcp-server.ts`, `history.ts`), gives the task's history as
one text in parts of about 40,000 characters (10,000 tokens: under what agents take from one tool's result). Part 1
says how many there are; the agent calls the next ones in turn. The whole text is made at part 1 and kept (in memory,
with the task) for the next parts, so they stay the same while the agent reads them: its own transcript grows
meanwhile.

The text, in this order:

1. **Where the task stands** (Kulisa's part, what no transcript says): the task, its folder and branch; how the last
   run stopped (a tool call with no result: cut off, by a limit or the human; or the human's last message with no
   answer); for each copy of the code, its commits since the task started, the files not committed and `diff --stat`
   against its start (`progress` in `worktrees.ts`); the profiles open and closed; the terminals besides the
   agent's and what runs there.
2. **The runs' conversations, the latest chapter first.** A task's runs are the agents that worked in it, each with
   its transcript (`agent.json`: the current one in its fields, the earlier ones in `runs`, oldest first; a switch of
   the agent adds to them: tasks.md, "Switching the agent"). Each run's conversation is cut into **chapters** at its agent's compaction
   summaries: a chapter is a summary and what follows it up to the next. The chapters of all runs, in the order they
   happened, are given from the latest back. At the end of each run's last chapter: the agent's last plan
   (`TodoWrite`) and what it remembered in the task's folder (Claude Code's memory).

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
- **Useful beyond a switch**: an agent whose context was compacted reads the details again.

The agent learns of it from the MCP server's instructions (every agent) and the Kulisa plugin's skill (Claude Code).

## Claude Code's transcript

`<config folder>/projects/<task folder with / and other characters as ->/<session>.jsonl`: a JSON record per line;
`type` at its top; `user` and `assistant` records with `message.content`, a string or an array of blocks each with
its own `type`; `uuid`, `parentUuid`, `timestamp` on each; a tool call's `id` (`toolu_…`) is its result's
`tool_use_id`. Large tool outputs are kept apart in `<session>/tool-results/`, with a reference in the transcript.
Checked with Claude Code 2.1.296, on a session of the author's (56.7 MB, 14,529 records, 9 compaction summaries).

The reader (`claudeConversation`, `transcripts.ts`; the agent's `conversation` in its `agents.ts` entry), record by
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
| the agent's plan | a `tool_use` named `TodoWrite`, `input.todos` (`content`, `status`) | the last one | at its run's end (the session checked had none: not a sure source) |
| `task_history`'s own calls and results | a `tool_use` named `mcp__kulisa__task_history`, its result | | left out: the runs it gave are read from their own transcripts |
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

Not read yet (no Codex account to check it with): a run of Codex gives the history Kulisa's part alone. Known from
others (claude-codex-bridge): its sessions are `sessions/…/rollout-*.jsonl` in its `CODEX_HOME`, and its compaction
summaries are encrypted, so its chapters will have none.

## The code

| File | What |
|---|---|
| `src/main/history.ts` | the history's text: Kulisa's part, the runs' chapters, the parts |
| `src/main/transcripts.ts` | the readers: an agent's transcript as entries (`human`, `agent`, `call`, `result`, `error`, `summary`), its plan, where it stopped, its memory |
| `src/main/agents.ts` | each agent's `conversation`, its reader |
| `src/main/worktrees.ts` | `progress`: a copy's commits, files not committed, `diff --stat` |
| `src/main/mcp-server.ts` | the `task_history` tool, and a sentence of the instructions |
| `test/unit/transcripts.test.ts`, `test/agent.ts` | the tests: the reader record by record; the tool's order and parts |
