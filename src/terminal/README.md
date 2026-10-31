# The terminal

A terminal as Kulisa has it, the same wherever it is shown: a pty running the user's shell (an agent typed into it, a
command, or nothing), its output kept in the window, and an xterm that shows it. A Kulisa package
([docs/packages.md](../../docs/packages.md)), used by the task's terminals' panel (`components/grid/DevelopmentTerminals.tsx`,
`lib/development-terminals.ts`: its tabs, its agents' launchers and menus; docs/window.md, The terminal), an account's sign-in
(`components/SignIn.tsx` through `components/Terminal.tsx`: Settings' and New Project's) and the task's agents
(`tasks.ts`: which agent, its conversation, what is typed to it). It knows nothing of them, nor of the window's look: a
terminal is a key, `<task key>#<id>` for a task's, any string for a sign-in's; its colors and font size are the
caller's.

Stage terminal environments use the same runtime (`main/stage-terminals.ts`; docs/window.md, Stage
terminals), with their own Views and saved sizes. Their task-level lifecycle and commands stay outside this package.

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
- **An executable command line** (`execute`) is typed after the user's shell reads its first prompt, so
  prompt hooks such as direnv apply; the shell exits with the application's status after the command.
  Its caller owns stopped/running/exited state.
  `pressTerminalKey` encodes named keys according to terminal modes; `pasteTerminal` respects bracketed paste.
  `setTerminalSize` locks a session to a requested size or releases it to its View; `terminalScreen` flushes the
  parser (bounded to a second) and reads the current screen or tail. `sizeOf` is an explicit shared-size key:
  independent sessions never overwrite the size another place starts at.
- **At its real size.** Without an explicit size, it starts once the window has sent its size (`pty:resize`), or its panel's (`sizeOf`: a
  terminal behind another tab has none of its own), however long that takes: an agent draws its prompt for the size
  it starts with and does not fully redraw on the first resize.
- **What the agent reads of a shell.** It keeps a shell's screen, in memory: a terminal without a window
  (`@xterm/headless`, xterm's own parser), its last `screen` lines (500 for shell and application reads),
  with Unicode 11 widths matching the visible View, so what a program
  redraws in place (a progress, a container's state) is read as it became, not as every frame it went through. About
  1 MB a shell at 200 columns; an agent's terminal keeps none (`shell_read` does not read it). `terminalTail` gives its last lines.
- **Typing to an agent.** `typeIntoPrompt` pastes text into its prompt (bracketed: nothing in it is taken as a key),
  not sent; `eraseInPrompt` deletes the last characters before the cursor, as Backspace (the dictation's words
  corrected as they are heard); `sendToPrompt` sends a line as the human would, once its command was typed, and answers
  the question the agent asks then (Claude Code's `/add-dir`).
- **Typing to a shell.** `typeLine` types a command line and runs it; `interrupt` is Ctrl+C, as the human presses it
  (what runs stops, the shell stays). A line typed after a Ctrl+C waits until the shell reads its line again (as the
  agent's command waits at the start): Windows' console drops the input that comes before.
- **Esc typed by the human** reaches whoever asked (`onEscape`, with the terminal's key): what it means is theirs (an
  agent's turn ended: `Task.interrupted`, docs/tasks.md). Nothing outside listens to `pty:in` itself.
- `stopTerminal` ends it (its output reaches no window after); `keepScreen` retains its headless screen for the caller
  to read, disposed by a later stop without that option; `forgetTerminal` drops its size once it is gone.
  `stopAllTerminals`, as Kulisa quits: every one, their processes waited for (3 s at most; on Windows node-pty ends a
  ConPTY on threads of its own, and an app exiting before may end with an uncaught C++ exception).

## The window (`renderer/`)

`termFocus(key, wanted?)` waits for the bundled font and checks the caller’s optional predicate before focusing;
an asynchronous launch can cancel its request when the human puts the keyboard elsewhere.

**One xterm a place**: every terminal's output goes into a buffer of its own, an xterm never opened (its text,
scrollback and modes, no renderer: about 0.6 MB full), and each place that shows a terminal, the terminals' panel and an
account's sign-in and each Stage terminal, has one shown xterm (`View`) with a WebGL renderer, falling back to DOM
when WebGL is unavailable or its context is lost. A View fits its pane or uses fixed dimensions (`setSize`). Showing another terminal there writes
that one's buffer into it (`serialize`, after a reset, RIS, in the same write: xterm parses a write at once, so the
one shown before stays drawn until the other's is in, no frame empty between), its scroll put back, in about 15 ms; its
selection is lost, as when another tab is shown. While shown, a terminal's output goes into both, at one size, so leaving it costs
nothing; output coming while a buffer is being put in waits after it (`pending`). Why one: an xterm shown has a WebGL
context and its glyph atlas, and Chromium keeps 16 contexts a page: the 17th would take the oldest terminal's (often
the first task's agent), which would fall back to the DOM renderer silently. With 20 terminals on a discrete GPU, the
video memory 472 → 178 MB, the RAM about the same (on an integrated GPU, or a Mac's, that memory is the RAM); with
Chromium's software GPU, 609 → 234 MB. (VS Code keeps an xterm a terminal.)

**Fitted in a frame about to be drawn.** A terminal is put in at its buffer's size, and the xterm and the buffer get
the room laid out only from the fit, measured in `requestAnimationFrame`: fitted at once in a window just opened, its
grid not laid out, the buffer would be wrapped at 9 columns. A place whose DOM size trails its layout supplies
`View.isLaidOut`: fitting waits for it before measuring and before sending the size. Resized after that frame: a resize
clears WebGL's canvas, which xterm draws again in the next frame, so one resized in a frame is drawn empty. A hidden
page draws no frames, so there it is measured at once: Windows hides a window other windows cover (one opening behind
them too), whose agents would otherwise start only once someone looks at it.

Serializing leaves out the cursor's visibility (`?25`) and the mouse's encoding (`?1006`, `?1015`, `?1016`: Claude
Code's fullscreen clicks), so each buffer follows them (`registerCsiHandler`, not taking them) and they are written
after it, every one with its value: the reset leaves a hidden cursor hidden in the next terminal shown, and turning an
encoding off sets the default one, so those off go first (`serialized`). A task moving to another window takes its
terminals' buffers the same way (`terminals:restore`), at the same size, also when its page showed the task first.

Set up as VS Code's: Unicode 11 widths (Claude Code draws ✅ ⏵ ✻; with Unicode 6 the cursor drifts a cell after each),
a bundled font (JetBrains Mono, which it imports with xterm's stylesheet, so any page that shows a terminal has them),
the WebGL renderer. **Its look is the place's**: `new View({ colors, fontSize })` (`TermStyle`: the background, the
text, selected text, as colors, not a window's tokens), and `restyle(…)` when the place's theme changes, so the package
reads nothing of a window's CSS or theme. The programs' own colors stay xterm's, readable on either background by its
`minimumContrastRatio`. The rows that fit sit in the middle of the xterm, what is left under a whole row shared above and below them, so two tasks whose grids differ by a pixel do
not show a row's height under the agent's status line in one and nothing in the other.

Copy and paste take the keys of the OS's own terminal, so hands need nothing new: Ctrl+Shift+C / V (GNOME Terminal,
Konsole); on Windows also Ctrl+V, and Ctrl+C copies a selection, else interrupts (Windows Terminal); on macOS ⌘C / ⌘V
(the app menu's). xterm leaves those keys to the app, as VS Code sets its own; otherwise Ctrl+C and Ctrl+V go to the
agent (Claude Code pastes an image with Ctrl+V, with Alt+V on Windows). The paste itself is Chromium's, which xterm
takes (pasting again from Kulisa would double it). An image in a paste event goes to `termHooks.pasteImage`, with the
terminal's key; the caller chooses what it means. The menu's `termPaste` reads clipboard types and takes the same
image hook or pastes text. A reply is used only while the same terminal is shown. With nothing selected in xterm, copying keeps the clipboard: Claude
Code's fullscreen rendering selects with its own mouse and copies on release itself (an empty copy would wipe it); Shift held while dragging selects in xterm instead. Keys are known by `keyCode` too, as
ibus with a Cyrillic layout leaves `code` out.

Files dropped onto a View are disk paths from the preload's `webUtils.getPathForFile`, quoted for that terminal's
shell (`pty:quote-paths`, `quotePaths`), separated by spaces and pasted through xterm, without Enter. A reply is used
only while the same terminal is shown. JavaScript-created Files have no disk path and are ignored. The drop cancels
Chromium's navigation; the log records the terminal and file count, never the paths. The main entry exports
`quotePaths` for the caller's Send to Agent actions to use the same shell literals.

Links (OSC 8, as Claude Code marks them, and addresses in plain text: xterm's web-links addon) open with Ctrl+click (⌘
on macOS), `http` and `https` only, the address shown on hover, through `termHooks.open`, which the terminals' panel
sets (a menu: one of the task's profiles, or the user's browser; docs/window.md, The terminal), not xterm's own
handler, which asks with the browser's `confirm()`, an OS dialog.

A path is a link too, when it names a file or folder that exists (an agent's answer names its files): absolute (`/…`, `~/…`, `C:\…`, `\\server\share\…`) or relative (`src/main/tasks.ts`),
a `:line[:column]` after it kept in the link and left out of the path, a quoted one with spaces in it. Finding the
candidates in a line is here (`renderer/paths.ts`, xterm's `registerLinkProvider` beside the web-links addon), in the
line as its program wrote it: the rows xterm wrapped it into joined (`isWrapped`), each character with its cell, so a
path broken by the width is one link and wide characters before it (Claude Code's ⏺) do not shift it. xterm leaves
this to the app (only the app knows the disk and the folder); the web-links addon does addresses only and exports
nothing else. Whether one exists, and what is done with it, is the window's, through `termHooks.files` (a line's candidates asked at once, as the pointer comes
over it; without the hook a path is no link) and `termHooks.openFile` (Ctrl+click, ⌘ on macOS); the full path shown on
hover. A file an agent marks as a link (OSC 8) goes to `openFile` too: Claude Code gives its path as it is, others a
`file://` address. xterm drops an OSC 8 link that is not `http(s)` unless `allowNonHttpProtocols` is set, so it is, and
`termLinks.activate` keeps only those two and paths (`javascript:` and the like go nowhere).

**One protocol responder per terminal.** Its unopened renderer buffer answers xterm's device, status and color
queries even for a hidden task; each visible View consumes those queries through xterm's parser hooks so replies are
not doubled. `termHooks.colors` supplies the caller's palette for color queries; a single detached 2 × 1 xterm
initializes xterm's theme service for those replies without a renderer per buffer. Every output packet carries the
PTY's columns and rows, so a buffer created for a background session starts at its actual dimensions. The headless
main-process parser retains screen text and modes for reads and input encoding; its generated replies stay unused.

## Its channels (`ipc.ts`)

`pty:quote-paths` (invoke: shell literals for dropped files), `pty:in` (keys), `pty:resize` (the size shown), `pty:out` (output, to the window of the task it is in),
`terminals:restore` (a task's terminals' contents, written into the buffers of the window it moves to),
`terminals:gone` (their buffers dropped). `src/shared/ipc.ts` joins them into all of the window's channels.

`View.find(text, previous, incremental)` lazily loads xterm's MIT-licensed search addon and searches the shown
terminal's buffer, including wrapped lines and scrollback. `clearSearch()` removes its selection. Resize and parsed output refresh an open search; `onSearchResult` reports whether it matches. The window owns
the search controls and their keyboard shortcuts; no extra output buffer is kept.

## Callers and ownership

Development terminals and Stage terminals use the same `startTerminal`, input, screen, sizing and cleanup APIs.
`TerminalConfig` describes launch options; `TerminalOutput` delivers output to the caller’s current window. Neither
contains task, agent or Stage types. The caller owns persistence, terminal keys and when to stop or forget a session.

`main/tasks.ts` owns development terminals and agent conversations. `main/stage-terminals.ts` owns Stage
launch setup and run state through an explicit host contract; `Task` supplies current folder/environment, saved
setup and window notifications. Their rules stay outside this Kulisa package. Window components own layouts,
menus and search controls; the package owns terminal rendering and matching.

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

Its e2e tests are in `test/e2e/` with the others: `window.spec.ts` (the xterm's set-up; one xterm for the terminals'
panel, switching), `grid*.spec.ts` (copy and paste, links, moving to another window), `tasks.spec.ts` (the terminals'
panel, shells), `stage-terminals.spec.ts` (interactive applications, screen parsing, restore and process cleanup).
