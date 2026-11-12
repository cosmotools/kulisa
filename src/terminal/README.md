# The terminal

Shared PTY, bounded screen buffers and xterm Views, a [Kulisa package](../../docs/packages.md). Callers own tasks,
agents, sign-in and Stage lifecycle, terminal keys, typography and colors. Development terminals, account sign-in
and Stage terminals use the same runtime.

## The main process (`main/`)

- `startTerminal` opens the user's shell in the supplied folder: macOS login shell (`SHELL` or account fallback),
  Linux user's shell, Windows `pwsh` or `powershell.exe`. Shell startup applies project settings such as direnv.
- Type launch commands once bracketed paste indicates prompt readiness, or after quiet fallback. Prefix with a space
  to avoid history. Quote per shell (`shell-quote.ts`), including fish's backslash rules. Type pinned account
  variables with the command so startup scripts cannot override them. An undefined pinned value removes the variable
  (POSIX `env -u`, PowerShell `$env:…=$null`), including overrides introduced by shell startup.
- PowerShell sets `$env:…`, runs with `&`, and uses Legacy argument passing on PS7 for PS5.1 compatibility. Quote
  arguments for the Windows runtime; resolve programs with `PATHEXT`. Use node-pty's bundled ConPTY so xterm receives
  device/color queries.
- `execute` waits for the first prompt, runs the command, then exits with its status. Callers own run state.
- Wait for the first real `pty:resize` unless explicit dimensions exist; `sizeOf` names a shared panel size, and
  independent sessions never overwrite it. An agent's first prompt can render incorrectly at a provisional size.
- Shell/Stage reads use `@xterm/headless` with Unicode 11 and bounded `TERMINAL_LINES`, retaining rendered state,
  not intermediate redraws. Agent terminals keep no main-process screen. `terminalScreen` flushes the parser with
  a one-second bound; `terminalTail` returns the tail.
- `typeIntoPrompt` pastes without sending; `eraseInPrompt` removes cursor-adjacent characters; `sendToPrompt` submits
  once launch is ready and can answer a CLI directory question. `typeLine` runs shell commands; `interrupt` sends
  Ctrl+C, then waits for prompt readiness before subsequent input, avoiding dropped Windows console input.
- `pressTerminalKey` follows terminal modes; `pasteTerminal` honors bracketed paste. `setTerminalSize` locks dimensions
  or releases fitting. Human Esc calls the supplied `onEscape`; outside code never listens directly to `pty:in`.
- Stop a live process once: ConPTY handles reject double kills. `keepScreen` retains readable final output until a
  later stop disposes it; `forgetTerminal` drops saved size. On quit, `stopAllTerminals` waits up to 3 s for ConPTY
  cleanup threads to avoid C++ exceptions.

## The window (`renderer/`)

`termFocus(key, wanted?)` waits for fonts and rechecks intent, preventing delayed focus theft.

**One xterm per visible place.** Each session owns an unopened renderer buffer (~0.6 MB full); development,
sign-in and Stage places own a visible `View`. Use WebGL with DOM fallback on unavailability/context loss. Per-terminal
renderers exhaust Chromium's 16-context limit and retain unnecessary GPU memory.

Switching sessions within one View resets/serializes the buffer in one write, restores scroll, loses selection and
queues pending output. The View stays transparent through restoration and reveals on `onRender` after buffer/pane sizes agree;
opacity preserves measurement and focus. Visible output updates View and buffer at the same size.
Fit from host DOM dimensions, coalesced in `requestAnimationFrame`; apply resize after that frame so clearing WebGL
does not expose a blank canvas. Hidden pages fit immediately because Windows occlusion can suspend frames indefinitely.

Serialization omits cursor visibility and mouse encodings. Track `?25`, `?1006`, `?1015`, `?1016` through parser hooks,
restore every value, and disable encodings before enabling the chosen one. This serialization serves session
switches within a UI. Task selection and live window moves keep the same UI, View and buffers without serialization.

Use Unicode 11 widths and bundled JetBrains Mono/xterm CSS. Callers supply `TermStyle` through constructor/restyle;
program colors use `minimumContrastRatio`. Center whole rows vertically to avoid inconsistent bottom gaps.

**Clipboard and drops.** Linux uses Ctrl+Shift+C/V; Windows additionally Ctrl+C copies a selection or interrupts,
and Ctrl+V pastes; macOS uses Edit-menu ⌘C/V. Leave other keys to the program. Chromium owns paste delivery to xterm;
image events call `termHooks.pasteImage`. Menu `termPaste` uses the same image/text decision. Preserve clipboard on
empty copy; Shift-drag uses xterm selection. Match `keyCode` too for layouts where ibus omits `code`.

File drops use preload `webUtils.getPathForFile`, `pty:quote-paths`/`quotePaths`, and paste shell-quoted paths separated
by spaces without Enter. Ignore synthetic Files with no path, cancel browser navigation, and apply asynchronous
clipboard/drop replies only to the still-shown terminal. Log terminal/file count, never paths. Export quoting for
caller Send to Agent actions.

**Links.** Ctrl+click (⌘ on macOS) uses `termHooks.open`, with hover URL; never xterm's native-confirm handler.
`renderer/paths.ts` also recognizes absolute/home/Windows/UNC/relative paths, optional `:line[:column]` and quoted
spaces. Join wrapped rows and retain cell mappings for wide characters. Batch existence checks through
`termHooks.files` on hover; `openFile` is caller-owned. Without hooks, paths are not links. Permit OSC 8 non-HTTP
protocols only to receive file links, then allow only http(s) and paths, rejecting executable URL schemes.

**Protocol replies.** Only each unopened renderer buffer answers device/status/color queries, including hidden
tasks; visible Views consume queries without replying. `termHooks.colors` supplies palette; one detached 2 × 1 xterm
initializes theme services. PTY packets carry dimensions for background buffers. Main's headless parser retains
screen/modes but sends no replies. UI JS stalls delay these replies; UI process loss/reload loses its emulator state
while owned PTYs continue. Issue #399 owns moving this service out of the UI. Raw output uses Electron IPC without
a proven bounded backpressure contract; finite burst/stall checks do not establish an unlimited stall guarantee.
Do not pause working PTYs from UI visibility, drop authoritative raw bytes, or add a second output-history store.
UI reload reconstructs screens from future output, without automatically restarting/resuming agents.

## Its channels (`ipc.ts`)

`pty:quote-paths` (invoke: shell literals for dropped files), `pty:in` (keys), `pty:resize` (the size shown), `pty:out` (output, to the owning task UI),
`terminal:gone` (their buffers dropped). `src/shared/ipc.ts` joins them into all of the window's channels.

`View.find(text, previous, incremental)` lazily loads xterm's MIT-licensed search addon and searches the shown
terminal's buffer, including wrapped lines and scrollback. `clearSearch()` removes its selection. Resize and parsed output refresh an open search; `onSearchResult` reports whether it matches. The window owns
the search controls and their keyboard shortcuts; no extra output buffer is kept.

## Callers and ownership

Development terminals and Stage terminals use the same `startTerminal`, input, screen, sizing and cleanup APIs.
`TerminalConfig` describes launch options; the caller routes `TerminalOutput` to the owning UI. Neither
contains task, agent or Stage types. The caller owns persistence, terminal keys and when to stop or forget a session.

`main/tasks.ts` owns development terminals and agent conversations. `main/stage-terminals.ts` owns Stage
launch setup and run state through an explicit host contract; `Task` supplies current folder/environment, saved
setup and task UI notifications. Their rules stay outside this Kulisa package. Window components own layouts,
menus and search controls; the package owns terminal rendering and matching.

## The code

- `main/index.ts`, `renderer/index.ts`, `ipc.ts`: public runtime/View entries and channel contracts.
- `main/shell-quote.ts`: launch/path quoting per shell. `renderer/paths.ts`: candidate paths and wrapped/wide-cell maps.
- `shell-quote.test.ts`, `paths.test.ts`: installed-shell quoting and parser/link cases.
- E2e: `window.spec.ts`, `grid*.spec.ts`, `tasks.spec.ts`, `stage-terminals.spec.ts` cover switching, input/clipboard,
  links, window moves, screen reads, restore and cleanup. Caller lifecycle is outside the package.
