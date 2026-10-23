# The agent's tools: how they are designed

The Kulisa plugin's MCP tools are how any agent works in the profiles, the tasks and the terminals. They are in
`tools/`, a file a group (`profile.ts`, `browser.ts`, `task.ts`, `terminal.ts`; what they share, `handles.ts`), a new
tool in its group's file; the server that gathers them is `mcp-server.ts`. This file says what makes a tool right, and
why. How each part works: `docs/profiles.md` (What the agent does; Actions) and the profiles skill
(`src/agent/skills/profiles/SKILL.md`).

## Principles

1. **The reader is the agent.** A tool's `registerTool` description is its documentation and the one source: what it
   does, when to use it, what it costs. The skill says how the tools fit together (the order, the rules, when to use
   which) and never lists them.
2. **The same tools for every agent.** A capability is an MCP tool, so Claude Code, Codex and any other CLI get it;
   what only one agent has (its permissions, its hooks) is an extra in its file in `agents/`.
3. **One core, a thin handle.** The action, its checks and its rules are the core's (`Task`, `Profile`); the tool
   finds what to act on, calls it and translates the answer. The human gets the same action in the window (the root
   `CLAUDE.md`, Architecture).
4. **Tools, not the work's logic.** A tool gives a capability; the steps of the work are the agent's. A tool that
   cannot act says what is missing rather than doing something else (the root `CLAUDE.md`, Architecture).
5. **An action with a meaning, not an API's wrapper.** A tool is named and shaped by what the agent wants ("the
   failed requests to /api"), not by the library call under it. Its parameters let the agent narrow what it gets (a
   filter, a part, a period); the defaults are what most calls need.
6. **The human sees, and stays in charge.** What the agent does shows in the page; the human's tabs stay as they
   were; the sign-in pause holds (automation reaches pages only through the CDP proxy); passwords, cookies and tokens
   never reach the agent.
7. **A missing tool shows itself.** The agent going around the tools (a Playwright script of its own, `curl`, asking
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

The context is the agent's working memory, shared with the code and its reasoning: every token a tool puts there is
one less for thinking.

1. **Narrow, don't dump.** Where playwright-core gives a lot (a page's requests, its console, its snapshot), the tool
   wraps it with filters, so the agent takes only what it needs: requests by address and without static files, the
   console by level, a snapshot of one element or to a depth. How other tools do it (Playwright MCP, Chrome DevTools
   MCP) is worth a look; what to take is decided on its merits.
2. **A part, not the whole.** A screenshot of an element or a region, not of the page; a snapshot of a subtree, not
   of the document.
3. **Large goes to disk.** A snapshot, a screenshot or a response's body over a limit is written to a file in the
   task's data folder (never the project's folder: nothing of Kulisa's in the agent's `git status`), one per tab,
   rewritten each time. The answer gives its path and a short outline, and the agent reads the part it needs.
4. **A signal before the content.** An action's answer carries counts (2 console errors, 1 failed request), so the
   agent reads the details only when there are some.
5. **An action answers in a line**: what was done and where the page is now. A snapshot only when asked for.
6. **Text before pictures.** A picture costs the most: a screenshot only when the look matters, scaled down, as JPEG.
7. **Saving never takes a capability away.** The defaults give little; a parameter always gives all, so the agent
   never meets a wall where what it needs cannot be had.
