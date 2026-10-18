# The terminal

A terminal as Kulisa has it, the same wherever it is shown: a pty running the user's shell (an agent typed into it, a
command, or nothing), its output kept in the window, and an xterm that shows it. A Kulisa package
([docs/packages.md](../../docs/packages.md)), used by the task's island (`Terminals.vue`, `TerminalTabs.vue`,
`lib/terminals.ts`: its tabs, its agents' launchers and menus; docs/window.md, The terminal), an account's sign-in
(`AccountSignIn.vue`) and the task's agents (`tasks.ts`: which agent, its conversation, what is typed to it). It knows
nothing of them: a terminal is a key, `<task key>#<id>` for a task's, any string for a sign-in's.

## The main process (`main/`)

- **In the user's shell.** `startTerminal` starts the user's shell (a login shell on macOS, as Terminal and VS Code
  do; `SHELL`, else the account's: an app started from the Dock may have none) in the folder given, and types the
  command into it once the shell reads its input line (it turns bracketed paste on; else after a quiet moment), with a
  leading space, which keeps it out of the shell's history. The shell's startup sets the project's environment
  (direnv's `.envrc`, nvm, mise), which Kulisa's own is not, and the shell stays when the command exits. Each argument
  is quoted as that shell reads it (`shell-quote.ts`): the sh way for bash and zsh, fish's own for fish, which reads
  `\\` and `\'` inside `'…'` (a prompt with `\'` left the quote open, and the agent did not start; 2026-10-18).
  `pinned` variables are typed before the command (`VAR=… cmd`), so a project's `.envrc` cannot change them (an
  agent's account: one ran a task as another Claude account, 2026-10-12). On Windows the command starts directly,
  without a shell (ROADMAP).
- **At its real size.** It starts only once the window has sent its size (`pty:resize`), or its island's (`sizeOf`: a
  terminal behind another tab has none of its own), however long that takes: an agent draws its prompt for the size
  it starts with and does not fully redraw on the first resize. Until 2026-10-15 it started at a default size after
  5 s, which GitHub's runner reached.
- **What the agent reads of a shell.** It keeps a shell's screen, in memory: a terminal without a window
  (`@xterm/headless`, xterm's own parser), its last `screen` lines (the MCP server's `READ_MAX`, 500), so what a program
  redraws in place (a progress, a container's state) is read as it became, not as every frame it went through (the
  output with its codes left out, until 2026-10-12). About 1 MB a shell at 200 columns; an agent's terminal keeps none
  (`terminal_read` does not read it). `terminalTail` gives its last lines.
- **Typing to an agent.** `typeIntoPrompt` pastes text into its prompt (bracketed: nothing in it is taken as a key),
  not sent; `sendToPrompt` sends a line as the human would, once its command was typed, and answers the question the
  agent asks then (Claude Code's `/add-dir`).
- `stopTerminal` ends it (its output reaches no window after); `forgetTerminal` drops its size once it is gone.

## The window (`renderer/`)

**One xterm a place** (the author's idea, built 2026-10-18): every terminal's output goes into a buffer of its own, an xterm
never opened (its text, scrollback and modes, no renderer: about 0.6 MB full), and each place that shows a terminal,
the island and an account's sign-in, has one shown xterm (`View`), the only one with a renderer. Showing another
terminal there writes that one's buffer into it (`serialize`, after `reset()`), its scroll put back: about 15 ms more
than when each terminal was an xterm of its own; its selection is lost, as when another tab is shown. While shown, a
terminal's output goes into both, at one size, so leaving it costs nothing; output coming while a buffer is being put
in waits after it (`pending`). Why: each xterm had its renderer, a WebGL context and its glyph atlas, and Chromium
keeps 16 contexts a page: the 17th took the oldest terminal's, often the first task's agent, which drew with the DOM
renderer from then on, silently. Measured 2026-10-18 in a scratch Kulisa on a GeForce GTX 1660: with 20 terminals,
the video memory 472 → 178 MB and the shown terminal on WebGL, not DOM; the RAM about the same (± 30 MB: on a real GPU
the atlases are in its own memory; on an integrated one, or a Mac's, that memory is the RAM, not measured yet); in
bare Electron with Chromium's software GPU, 609 → 234 MB. VS Code keeps an xterm a terminal (its pty host a headless
one a pty, to reconnect).

Serializing leaves out the cursor's visibility (`?25`) and the mouse's encoding (`?1006`, `?1015`, `?1016`: Claude
Code's fullscreen clicks), so each buffer follows them (`registerCsiHandler`, not taking them) and they are written
after it, every one with its value: `reset()` left a hidden cursor hidden in the next terminal shown, and turning an
encoding off sets the default one, so those off go first (`serialized`). A task moving to another window takes its
terminals' buffers the same way (`terminals:restore`), at the same size.

Set up as VS Code's: Unicode 11 widths (Claude Code draws ✅ ⏵ ✻; with Unicode 6 the cursor drifts a cell after each),
a bundled font (JetBrains Mono, at the window's `--font`), the WebGL renderer, the panels' colors (the programs' own
stay xterm's, readable on either background by its `minimumContrastRatio`). The rows that fit sit in the middle of
the xterm, what is left under a whole row shared above and below them: at the bottom, it was a row's height under the
agent's status line in one task and nothing in another, whose grids differed by a pixel (2026-10-08).

Copy and paste take the keys of the OS's own terminal, so hands need nothing new: Ctrl+Shift+C / V (GNOME Terminal,
Konsole); on Windows also Ctrl+V, and Ctrl+C copies a selection, else interrupts (Windows Terminal); on macOS ⌘C / ⌘V
(the app menu's). xterm leaves those keys to the app, as VS Code sets its own; otherwise Ctrl+C and Ctrl+V go to the
agent (Claude Code pastes an image with Ctrl+V, with Alt+V on Windows). The paste itself is Chromium's, which xterm
takes (pasting again from Kulisa had doubled it). With nothing selected in xterm, copying keeps the clipboard: Claude
Code's fullscreen rendering selects with its own mouse and copies on release itself (code.claude.com/docs/en/fullscreen;
an empty copy had wiped it); Shift held while dragging selects in xterm instead. Keys are known by `keyCode` too, as
ibus with a Cyrillic layout leaves `code` out.

Links (OSC 8, as Claude Code marks them, and addresses in plain text: xterm's web-links addon) open with Ctrl+click (⌘
on macOS), `http` and `https` only, the address shown on hover, through `termHooks.open`, which the island sets (a menu:
one of the task's profiles, or the user's browser; docs/window.md, The terminal).

## Its channels (`ipc.ts`)

`pty:in` (keys), `pty:resize` (the size shown), `pty:out` (output, to the window of the task it is in),
`terminals:restore` (a task's terminals' contents, written into the buffers of the window it moves to),
`terminals:gone` (their buffers dropped). `src/shared/ipc.ts` joins them into all of the window's channels.

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process's entry: the pty, typed into the user's shell; its size; a shell's screen; typing to an agent |
| `main/shell-quote.ts` | an argument quoted as the user's shell reads it (sh, fish) |
| `renderer/index.ts` | the window's entry: the buffers, `View` (the xterm a place shows), copy and paste, links |
| `renderer/tsconfig.json` | the window half checked as the window is (ESLint finds it by it) |
| `ipc.ts` | its channels |
| `shell-quote.test.ts` | quoting, in each shell installed (`npm run test:unit`) |

Its e2e tests are in `test/` with the others (a group is one app): `window.ts` (the xterm's set-up; one xterm for the
island, switching), `grid.ts` (copy and paste, links, moving to another window), `tasks.ts` (the island, shells).
