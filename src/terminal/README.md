# The terminal

A terminal as Kulisa has it, the same wherever it is shown: a pty running the user's shell (an agent typed into it, a
command, or nothing), its output kept in the window, and an xterm that shows it. A Kulisa package
([docs/packages.md](../../docs/packages.md)), used by the task's island (`Terminals.vue`, `TerminalTabs.vue`,
`lib/terminals.ts`: its tabs, its agents' launchers and menus; docs/window.md, The terminal), an account's sign-in
(`AccountSignIn.vue`) and the task's agents (`tasks.ts`: which agent, its conversation, what is typed to it). It knows
nothing of them: a terminal is a key, `<task key>#<id>` for a task's, any string for a sign-in's.

## The main process (`main/`)

- **In the user's shell.** `startTerminal` starts the user's shell (a login shell on macOS, as Terminal and VS Code
  do; `SHELL`, else the account's: an app started from the Dock may have none; on Windows PowerShell, as Windows
  Terminal opens it: `pwsh` when installed, else the system's `powershell.exe`) in the folder given, and types the
  command into it once the shell reads its input line (it turns bracketed paste on; else after a quiet moment), with a
  leading space, which keeps it out of the shell's history. The shell's startup sets the project's environment
  (direnv's `.envrc`, nvm, mise), which Kulisa's own is not, and the shell stays when the command exits. Each argument
  is quoted as that shell reads it (`shell-quote.ts`): the sh way for bash and zsh, fish's own for fish, which reads
  `\\` and `\'` inside `'…'` (a prompt with `\'` quoted the sh way leaves the quote open, and the agent does not start).
  `pinned` variables are typed before the command (`VAR=… cmd`), so a project's `.envrc` cannot change them (an
  agent's account: else the task would run as the account the `.envrc` names). PowerShell gets a line of its own: the
  variables set first (`$env:VAR=…`), then the command run by `&`, in a script block that sets PowerShell 7's passing
  of arguments to Windows PowerShell 5.1's (`Legacy`), so one quoting serves both: each argument as a Windows
  program's runtime reads its command line back, one with a space in quotes of its own (left to PowerShell, 5.1 and 7
  differ on the backslashes before the quote they add); the command in PowerShell's `'…'` alone. A program is
  found by name as Windows' shells find it (`PATHEXT`: `claude` may be a `.cmd`), which node-pty does not do.
- **At its real size.** It starts only once the window has sent its size (`pty:resize`), or its island's (`sizeOf`: a
  terminal behind another tab has none of its own), however long that takes: an agent draws its prompt for the size
  it starts with and does not fully redraw on the first resize.
- **What the agent reads of a shell.** It keeps a shell's screen, in memory: a terminal without a window
  (`@xterm/headless`, xterm's own parser), its last `screen` lines (the MCP server's `READ_MAX`, 500), so what a program
  redraws in place (a progress, a container's state) is read as it became, not as every frame it went through. About 1 MB a shell at 200 columns; an agent's terminal keeps none
  (`terminal_read` does not read it). `terminalTail` gives its last lines.
- **Typing to an agent.** `typeIntoPrompt` pastes text into its prompt (bracketed: nothing in it is taken as a key),
  not sent; `eraseInPrompt` deletes the last characters before the cursor, as Backspace (the dictation's words
  corrected as they are heard); `sendToPrompt` sends a line as the human would, once its command was typed, and answers the question the
  agent asks then (Claude Code's `/add-dir`).
- **Typing to a shell.** `typeLine` types a command line and runs it; `interrupt` is Ctrl+C, as the human presses it
  (what runs stops, the shell stays). A line typed after a Ctrl+C waits until the shell reads its line again (as the
  agent's command waits at the start): Windows' console drops the input that comes before.
- **Esc typed by the human** reaches whoever asked (`onEscape`, with the terminal's key): what it means is theirs (an
  agent's turn ended: `Task.interrupted`, docs/tasks.md). Nothing outside listens to `pty:in` itself.
- `stopTerminal` ends it (its output reaches no window after); `forgetTerminal` drops its size once it is gone.
  `stopAllTerminals`, as Kulisa quits: every one, their processes waited for (3 s at most; on Windows node-pty ends a
  ConPTY on threads of its own, and an app exiting before may end with an uncaught C++ exception).

## The window (`renderer/`)

**One xterm a place**: every terminal's output goes into a buffer of its own, an xterm
never opened (its text, scrollback and modes, no renderer: about 0.6 MB full), and each place that shows a terminal,
the island and an account's sign-in, has one shown xterm (`View`), the only one with a renderer. Showing another
terminal there writes that one's buffer into it (`serialize`, after `reset()`), its scroll put back, in about 15 ms;
its selection is lost, as when another tab is shown. While shown, a
terminal's output goes into both, at one size, so leaving it costs nothing; output coming while a buffer is being put
in waits after it (`pending`). A terminal is put in at its buffer's size, and the xterm and the buffer get the room
laid out only from the fit, measured in a frame about to be drawn (`requestAnimationFrame`): measured between frames,
during a task's slide (a view transition, which builds the next grid while nothing is drawn), the room is passing
(954 px for 293) and no ResizeObserver tells of the room it ends with, so the agent would keep 52 rows in a panel of
16; and fitted at once in a window just opened, its grid not laid out, the buffer would be wrapped at 9 columns. A
hidden page draws no frames and runs no transition, so there it is measured at once once it has drawn a frame: Windows
hides a window other windows cover, whose agents would otherwise start only once someone looks at it. A window just
opened is hidden before its first frame too, its grid not laid out: it waits for that frame (measured then, a moved
task's terminal got 8 columns). Why
one: an xterm shown has its renderer, a WebGL context and its glyph atlas, and Chromium keeps 16 contexts a page: with
an xterm a terminal, the 17th would take the oldest terminal's, often the first task's agent, which would draw with
the DOM renderer from then on, silently. With 20 terminals on a discrete GPU,
the video memory 472 → 178 MB and the shown terminal on WebGL, not DOM; the RAM about the same (± 30 MB: on a real GPU
the atlases are in its own memory; on an integrated one, or a Mac's, that memory is the RAM); in
bare Electron with Chromium's software GPU, 609 → 234 MB. VS Code keeps an xterm a terminal (its pty host a headless
one a pty, to reconnect).

Serializing leaves out the cursor's visibility (`?25`) and the mouse's encoding (`?1006`, `?1015`, `?1016`: Claude
Code's fullscreen clicks), so each buffer follows them (`registerCsiHandler`, not taking them) and they are written
after it, every one with its value: `reset()` leaves a hidden cursor hidden in the next terminal shown, and turning an
encoding off sets the default one, so those off go first (`serialized`). A task moving to another window takes its
terminals' buffers the same way (`terminals:restore`), at the same size, also when its page showed the task first.

Set up as VS Code's: Unicode 11 widths (Claude Code draws ✅ ⏵ ✻; with Unicode 6 the cursor drifts a cell after each),
a bundled font (JetBrains Mono, at the window's `--font`), the WebGL renderer, the colors of the place it is in (its
background a token the place gives `View`, so the terminal is of a piece with it; the programs' own colors stay
xterm's, readable on either background by its `minimumContrastRatio`). The rows that fit sit in the middle of
the xterm, what is left under a whole row shared above and below them, so two tasks whose grids differ by a pixel do
not show a row's height under the agent's status line in one and nothing in the other.

Copy and paste take the keys of the OS's own terminal, so hands need nothing new: Ctrl+Shift+C / V (GNOME Terminal,
Konsole); on Windows also Ctrl+V, and Ctrl+C copies a selection, else interrupts (Windows Terminal); on macOS ⌘C / ⌘V
(the app menu's). xterm leaves those keys to the app, as VS Code sets its own; otherwise Ctrl+C and Ctrl+V go to the
agent (Claude Code pastes an image with Ctrl+V, with Alt+V on Windows). The paste itself is Chromium's, which xterm
takes (pasting again from Kulisa would double it). With nothing selected in xterm, copying keeps the clipboard: Claude
Code's fullscreen rendering selects with its own mouse and copies on release itself (code.claude.com/docs/en/fullscreen;
an empty copy would wipe it); Shift held while dragging selects in xterm instead. Keys are known by `keyCode` too, as
ibus with a Cyrillic layout leaves `code` out.

Links (OSC 8, as Claude Code marks them, and addresses in plain text: xterm's web-links addon) open with Ctrl+click (⌘
on macOS), `http` and `https` only, the address shown on hover, through `termHooks.open`, which the island sets (a menu:
one of the task's profiles, or the user's browser; docs/window.md, The terminal), not xterm's own handler, which asks with the
browser's `confirm()`, an OS dialog.

A path is a link too, when it names a file or folder that exists (JetBrains' and VS Code's terminals do the same; an
agent's answer names its files): absolute (`/…`, `~/…`, `C:\…`, `\\server\share\…`) or relative (`src/main/tasks.ts`),
a `:line[:column]` after it kept in the link and left out of the path, a quoted one with spaces in it. Finding the
candidates in a line is here (`renderer/paths.ts`, xterm's `registerLinkProvider` beside the web-links addon), in the
line as its program wrote it: the rows xterm wrapped it into joined (`isWrapped`), each character with its cell, so a
path broken by the width is one link and wide characters before it (Claude Code's ⏺) do not shift it. xterm leaves
this to the app (its `registerLinkProvider` asks where a line's links are; what is one, and what opening it means, is
the app's: it alone knows the disk and the folder); the web-links addon does it for addresses only (what `new URL()`
takes), and exports nothing else. Whether one exists, and what
is done with it, is the window's, through `termHooks.files` (a line's candidates asked at once, as the pointer comes
over it; without the hook a path is no link) and `termHooks.openFile` (Ctrl+click, ⌘ on macOS); the full path shown on
hover. A file an agent marks as a link (OSC 8) goes to `openFile` too: Claude Code gives its path as it is, others a
`file://` address. xterm drops an OSC 8 link that is not `http(s)` unless `allowNonHttpProtocols` is set, so it is, and
`termLinks.activate` keeps only those two and paths (`javascript:` and the like go nowhere).

## Its channels (`ipc.ts`)

`pty:in` (keys), `pty:resize` (the size shown), `pty:out` (output, to the window of the task it is in),
`terminals:restore` (a task's terminals' contents, written into the buffers of the window it moves to),
`terminals:gone` (their buffers dropped). `src/shared/ipc.ts` joins them into all of the window's channels.

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process's entry: the pty, typed into the user's shell; its size; a shell's screen; typing to an agent or a shell; Esc |
| `main/shell-quote.ts` | an argument quoted as the user's shell reads it (sh, fish) |
| `renderer/index.ts` | the window's entry: the buffers, `View` (the xterm a place shows), copy and paste, links |
| `renderer/paths.ts` | the paths a line may name, each where it is in the line |
| `renderer/tsconfig.json` | the window half checked as the window is (ESLint finds it by it) |
| `ipc.ts` | its channels |
| `shell-quote.test.ts` | quoting, in each shell installed (`npm run test:unit`) |
| `paths.test.ts` | the paths found in a line and their cells (in `@xterm/headless`), what is no path, an agent's link to a file |

Its e2e tests are in `test/` with the others (a group is one app): `window.ts` (the xterm's set-up; one xterm for the
island, switching), `grid.ts` (copy and paste, links, moving to another window), `tasks.ts` (the island, shells).
