# The agent's tools: how they are designed

The Kulisa plugin's MCP tools, how any agent works in the profiles, the tasks and the terminals: `tools/`, a file a
group (`profile.ts`, `browser.ts`, `task.ts`, `terminal.ts`; what they share, `handles.ts`), a new tool in its group's
file; the server, `mcp-server.ts`. How each part works: `docs/profiles.md` (What the agent does; Actions) and the
profiles skill (`src/agent/skills/profiles/SKILL.md`).

## Principles

1. **The reader is the agent.** A tool's `registerTool` description is its documentation and the one source: what it
   does, when to use it, what it costs. The skill says how the tools fit together (the order, the rules, when to use
   which) and never lists them.
2. **As the root `CLAUDE.md` holds for all of Kulisa**: the same tools for every agent (what only one has is an extra
   in its file in `agents/`); one core, a thin handle (the action, its checks and rules are `Task`'s or `Profile`'s;
   the human gets it in the window too); tools, not the work's logic (a tool that cannot act says what is missing).
3. **An action with a meaning, not an API's wrapper.** A tool is named and shaped by what the agent wants ("the
   failed requests to /api"), not by the library call under it. Its parameters let the agent narrow what it gets (a
   filter, a part, a period); the defaults are what most calls need.
4. **The human sees, and stays in charge.** What the agent does shows in the page; the human's tabs stay as they
   were; the sign-in pause holds (automation reaches pages only through the CDP proxy); Kulisa never hands the agent a
   password (`browser_type_login` types it) or a cookie or token (`browser_network_request` hides them). What a script
   of the agent reads in a page is the agent's: Kulisa does not restrict it (`docs/profiles.md`).
5. **A missing tool shows itself.** The agent going around the tools (a Playwright script of its own, `curl`, asking
   the human to click) names a tool to build; so do the users' Ideas for Kulisa (issue #84).

## What a tool must be

A new tool, or a change to one, meets all of these:

- **Useful.** It does what the agent needs and cannot do as well with the tools there, and does it whole: no half
  result the agent must patch up with more calls.
- **Economical with the agent's context**: how, below.
- **Bounded.** Every wait has a timeout, every list a limit: a tool never holds the agent's turn.
- **Fast.** One call where the agent would need several (`browser_snapshot`'s `also`: several profiles at once); no
  work the answer does not need.
- **Light on the computer.** No process or buffer kept for it beyond its call. The only files it may keep are those
  "Large goes to disk" describes, and they go with their task (the root `CLAUDE.md`: "RAM matters", "Nothing piles
  up").
- **Clear when it fails.** The error says what is wrong and what to do: which profiles there are, that the human is
  signing in.
- **Safe.** It acts within its task only. Where it reaches the disk or a shell, the agent's own approval applies
  (`KULISA_ASKS`, `docs/profiles.md`); where it changes real accounts, Kulisa asks the human.
- **Tested.** Its behavior has a test (`docs/testing.md`). Its log line needs no code: `registerTool` writes it.

## Saving the agent's context

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
