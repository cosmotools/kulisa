# Testing

How Kulisa's tests are built, how to write one and when to run which. **Read this before writing or running a test.**

## What gets a test, and when to run what

- **What can break comes with a test**: a behavior, its logic, a bug fixed. Not a removal (what is removed simply is
  not there, as a feature never built), nor a cosmetic change (a symbol, a label, a color): ask what regression a test
  would catch; none, no test.
- **A bug is first reproduced by a failing test**, then fixed.
- **While building**: `npm run test:unit` (a second), some e2e files (`npm test -- e2e <file>…`), a screenshot (`KULISA_SHOT`,
  Running them) or the author's running Kulisa, restarted with the change (the `run-kulisa` skill). `npm run knip`
  once a step, when its code is written, before it is shown to the author, not after every change.
- **The full suite (`npm test`, minutes) runs once, when the author says the work is done** ("всё ок", "commit"),
  before the commit; fix what fails and run it again. Not for a change to documentation alone (`docs/`, `CLAUDE.md`,
  `README.md`): the pull request's CI runs it anyway.

## Two layers

| Layer | Where | Runs in | For |
|---|---|---|---|
| Unit | `test/unit/*.test.ts`, a Kulisa package's in its folder (`src/<package>/*.test.ts`) (`node:test`) | plain Node, about a second: `npm run test:unit` | logic that needs no window: names, the data folder, a task's profiles in order, the agents' files |
| End to end | `test/e2e/*.spec.ts` ([Playwright Test](https://playwright.dev/docs/test-intro)) | the real app, against the local test site (`fixtures/site.ts`) | everything the human or the agent does: the window, profiles' pages, MCP tools, restarts |

A check goes into the cheapest layer that can show the behavior: a rule about names is a unit test; that the name
field leaves characters out as they are typed is end to end. A module a unit test needs must load in plain Node (no
`node-pty`, no Electron objects used at load); when it cannot, the check stays end to end. There `'electron'` is only
the path of Electron's binary, so such a module takes Electron's objects from the module, not by name (`import
electron from 'electron'; const { session } = electron;`): an ES module importing `session` by name does not load.

## End to end

`npm test` runs the unit tests, knip (Dead code, below), ESLint (Lint, below), actionlint (Workflows, below), builds
the window (`npm run build`: its types checked, then Vite), then the e2e tests. `npm test -- e2e` or `npm run
test:e2e` builds and runs them alone; `npx playwright test keys -g "…"` some, after `npm run build`. Its parts:
`playwright.config.ts`, and in `test/e2e/` `fixtures.ts` (what a test gets), `app.ts` (Kulisa as the tests start it:
the fake agents, the test's folder, the switches), `driver.ts` (what a test reaches in the main process), `helpers.ts`
(the window driven as the human does: menus, the tasks' bar, Settings, the grid), `data.ts` (what Kulisa saved, read
from its files), `global-setup.ts` (the test site).

- **A file is one Kulisa, its tests independent**: each test makes what it needs and passes alone (`-g`) and in any
  order with its file's others; a failed test's worker is replaced, and the file's next tests get a new Kulisa. Its
  folder: `/tmp/kulisa-e2e-<checkout>-<hash>/<file>-<random>`, removed when it closes; each checkout's own, so runs
  from several worktrees go at once (CLAUDE.md, Conventions). The test site is the run's own, on a free port
  (`$KULISA_TEST_SITE`; in a test `SITE` and `PORT` from `helpers.ts`, never a literal port). Two runs in one checkout
  each take an `--output` of their own: they share `test-results/`, which a run empties as it starts.
- **What a test gets** (`fixtures.ts`): `ui`, the first window's page, and `sui()`, Settings', driven by Playwright's
  locators and web-first assertions (`await expect(locator).toBeFocused()`, which wait); `core(fn, arg)`, a function
  run in the main process with the driver (`k.shell`, `k.profile(name)`, `k.press(wc, key, …modifiers)`,
  `k.stash` for what a test keeps between calls, emptied before each test): only JSON crosses, so what it needs comes by `arg`, never by a
  closure; `call(tool, args, { task, terminal })` and `mcp()`, the agent's MCP; `files`, what Kulisa saved;
  `restart()`, Kulisa quit as the human quits it and started again on the same folder, giving the new window's page.
  A state of the core is waited for with `expect.poll(() => core(…))`.
- **Profiles' pages are driven through the core, the proxy and MCP**, never by Playwright attached to them: they
  are the agent's, behind the sign-in pause (Playwright's own attachment would also keep them visible: CLAUDE.md,
  Hard-won facts). Keys go into a page as input events (`k.press`), where the human's keyboard puts them, which
  Kulisa's keys see first. A page is given the keyboard as Kulisa gives it for the human (`profile.focusTab(tab)`),
  never by `webContents.focus()`: Kulisa takes that for the page's own and gives the keyboard back
  ([window.md](window.md), Keys: `page-focus.ts`).
- **Kulisa as the human runs it**: Electron started by its path with the tests' entry (`app.ts`), not by Playwright's
  `_electron`, which forces focus emulation on every page (a minimized window's page never hides) and a light color
  scheme. The tests connect to it over CDP (`connectOverCDP` with `noDefaults`: nothing in the pages changed) on a
  debugging port on 127.0.0.1, the test's alone: the one place Kulisa runs with one ([profiles.md](profiles.md), How
  automation reaches the pages). `core` goes over Electron's stdin and stdout, not Node's IPC channel: its
  `NODE_CHANNEL_FD` is inherited by Chromium's children, and DevTools' renderer crashes on it.
- **What an open port changes in the pages** (`navigator.webdriver` is true then) is tested in a file of its own with
  `test.use({ automation: false })`: Kulisa without the port, so no `ui`, `sui` or trace there.
- **On Linux each Kulisa has a screen of its own**: Xvfb with the openbox window manager (without one, windows are
  not listed for screenshots and focus differs from a desktop), its display chosen by Xvfb, X11's even from a Wayland
  desktop; the tests never take the human's focus or clipboard. `npm run test:visible` (`KULISA_VISIBLE=1`) puts the
  windows on the human's screen, as `npm test` does without Xvfb and openbox installed. One worker
  (`playwright.config.ts`): on macOS and Windows the Kulisas share one screen. No GPU on Xvfb:
  `--ignore-gpu-blocklist` lets WebGL run on Chromium's software renderer.
- **An uncaught error fails the test it came in**: the window's (`pageerror`), the main process's, and a Kulisa page's
  in any window.
- **A failed test leaves** the window as the screen shows it (profiles' pages included: `desktopCapturer`; a
  Playwright screenshot has the window's page alone), Playwright's trace of its steps (`npx playwright show-trace`),
  Kulisa's log and Electron's output, as its attachments: `test-results/`, the HTML report (`npx playwright
  show-report`), the CI's artifact.

### On macOS

Run from a terminal, as anywhere; what differs there:

- **The keyboard is the active app's.** macOS gives the keys and the focus only to the windows of the app in front,
  and the run starts from another (the terminal): `app.ts` brings the tests' app to the front (`app.focus({ steal:
  true })`). A click elsewhere during the run takes it back, and tests waiting for the focus fail: let it run.
- **⌘ for Kulisa's keys** (CommandOrControl in `keys.ts`): `CMD` in `helpers.ts` and `k.CMD` are ⌘ there, Ctrl elsewhere; Ctrl+`,
  Ctrl+Tab and the agent's keys stay Ctrl. ⌘C and ⌘V in the terminal are the Edit menu's, which a key sent into a
  page does not reach, nor `MenuItem.click` (the system runs those roles): the test checks the row is there and does
  what it does (`webContents.paste()`). Ctrl+T in a terminal is the tty's status key (SIGINFO) before it is the agent's.
- **No screenshots without the screen recording permission**, which macOS checks on the app that started the run
  (the terminal), not on Electron: a failed test's picture is then the window's page alone (`k.shot`); the tests of
  screenshots themselves are skipped with the reason. Granted to the terminal, they are taken.
- **Its temporary folders are named through a symlink** (`/var` is `/private/var`), where git answers with the real
  path, which `repoOf` (`worktrees.ts`) handles.
- A laptop's screen is narrower than Xvfb's 1920 px: a test needing room beside the window makes it narrower. GitHub's
  runner has 1024×768, too small for the tests' windows: the CI sets its virtual screen to 1920×1080 (displayplacer).
- **Motion is on whatever the OS says** (`force-prefers-no-reduced-motion` in `app.ts`): GitHub's macOS runner reduces
  motion, and the tests of a tab growing in and the grid's slide would wait for what never moves there. Reduced motion is
  checked where Kulisa does something else for it, emulated (`Emulation.setEmulatedMedia`).

What the tests cannot do there is checked by hand, again when something it depends on changes (an OS, an Electron,
the part's code):

- **The agent in the user's zsh** (`startTerminal` run alone in Electron, with their `.zshrc`): with no `SHELL` and the
  system's `PATH`, as from the Dock, the login zsh finds `claude`; direnv's hook loads the project's `.envrc`, and the
  account's `CLAUDE_CONFIG_DIR` typed before the command wins over the one it sets; arguments with spaces, `'`, `$`,
  `*`, `!` and JSON arrive as they were; the shell stays after the agent exits. A task closed and opened again resumes
  its conversation (`claude --resume`). fish, the command typed as `startTerminal` types it behind a headless
  xterm (fish asks the terminal and waits for its answer: in a bare pty it never reads a line): spaces, `'`, `$`,
  `*`, `!`, JSON, `\'`, `\\` and a pinned `VAR=…` arrive as they were; the shell stays. The quoting of every shell
  installed is a unit test too (`shell-quote.test.ts`; fish skipped where it is not, as on GitHub's runners).
- **Agents**: Codex installed by Kulisa (its maker's installer) and signed in to a real account; its tools
  from Kulisa's MCP server (`/mcp`: `kulisa`, connected). Claude Code's account signed in to again, refused as one
  already there: `auth logout` removed its Keychain entry (`Claude Code-credentials-<the first 8 hex digits of
  SHA-256 of its folder>`; the kept account's stays).
- **Ctrl+V in a terminal** reaches Claude Code: an image on the clipboard (⌃⇧⌘4; ⇧⌘4 saves a file, no image there)
  comes in as `[Image #n]`.
- **Sign-ins**: Google, GoDaddy and Microsoft (profiles.md, What sites see); session cookies encrypted with the
  Keychain (`safeStorage`: Chromium's `v10`, "kulisa Safe Storage").
- **Pages**: Teams' takes every click, its top strip too (the drag regions' workaround in: Upgrading Electron,
  below).
- **Keys** with a real keyboard: ⌘T, ⌘W, ⌘L, ⌘[ / ⌘] in a page are Kulisa's, not the site's; Ctrl+C and Ctrl+R stay the
  terminal's; ⌘C / ⌘V in the terminal.
- **Menus** with a trackpad: a right-click opens at the pointer and its release chooses nothing; press, drag and let go
  on a row chooses it; another app clicked closes a menu.
- **The theme** System follows macOS's Appearance as it changes.
- **Dictation**: the right ⌘ held records in Claude Code and puts the text in its input (with `voiceEnabled` given:
  agents/claude.ts); the microphone asked for Electron, which runs Kulisa from source.
- **The window**: the traffic lights centered in the bar at the zoom it is made at, moved as it changes, and taking a
  click (window.md, The title bar); the bar's empty part drags the window and a double click zooms it; New Project's Browse… is the system's folder dialog.
- **A build made there** (`npm run package`, unsigned, ad hoc): it starts by `open`; the first start is the empty
  window with the welcome; the Kulisa plugin and the skill sit outside the asar, node-pty's `spawn-helper` is
  executable, the icon is Kulisa's. Started again on real data: the task shown before
  comes back with its terminals, the one in front too, Claude Code and Codex resuming their conversations, a shell
  with nothing running; the right ⌘ held asks macOS for the microphone for
  Kulisa, and dictation then types.
- Screenshots of a Kulisa started by `open` need the permission on Electron.app itself: macOS takes it back when
  Electron is upgraded (ad hoc signed, a new binary is a new app to it), and it is granted again.

### On Windows

Run from a terminal, as anywhere, with Git for Windows installed (its `bash` in `PATH`: the test agent is
`bash -c '… exec cat -v'` with a `bashrc`, and the fake agent installed is a `.cmd` running its script with `bash`:
`test/e2e/app.ts`) and the Microsoft Visual C++ Redistributable (README, Run). What differs there:

- **The user's shell is PowerShell** (pwsh when installed, else Windows PowerShell: `src/terminal/`): the tests of the
  terminals type its commands (`WIN` in `helpers.ts`). The quoting test runs each one installed (`shell-quote.test.ts`).
- **ConPTY redraws the screen**: it sends a line again as it repaints it, the paste's marks in the middle of its echo,
  and after a resize a line padded with spaces to the width. A test reads what the terminal shows (`termText`: wrapped
  rows joined, each line's trailing spaces dropped), not the output, when it looks for what was typed or printed.
- **A right-click's menu opens on the release** (on the press elsewhere), and the terminal copies and pastes with
  Ctrl+C / Ctrl+V, Ctrl+C interrupting without a selection: `WIN` in `helpers.ts`.
- **A folder a process is in is not removed**, nor a file a process holds: a test removing a folder Kulisa looked into
  (a `git` it ran there) or a task's shell was in waits until it can; a deleted task's profiles go at the next start
  (their sessions hold their files: `deleted-folders.json`). Every folder is removed with `removeTree`
  (`src/main/remove.ts`), the tests' too: Electron's own `rmSync` refuses git's read-only files there and follows
  junctions.
- **Chromium is told a connection is refused after about 2 s**, a bare Electron's page too (Node at once): "at once"
  allows for it.
- GitHub's runner has 1024×768, as macOS's: the CI sets 1920×1080 (`Set-DisplayResolution`, Windows Server's).
- node-pty's helper prints `AttachConsole failed` when a terminal closes as its shell exits: its own race, harmless.

What the tests cannot do there is checked by hand, again when something it depends on changes (Windows, an Electron,
Claude Code, the part's code); what is left: ROADMAP, "Windows and macOS have gaps left".

- **Quitting**: `KULISA_QUIT` and `npm start`'s Ctrl+C (sent to its console: `GenerateConsoleCtrlEvent`) quit as
  SIGINT does elsewhere, the log saying so; `run-kulisa`'s `kulisa.sh` starts and stops Kulisa.
- **Claude Code's rule for the large pages' files** (`//c/…`, `agents/claude.ts`): with it `claude -p` reads a file
  outside its folder without asking, without it the read is refused.
- **The terminal's links**: a UNC path (`\\localhost\C$\…`) is found as a file; `C:\…` and what runs by its
  extension are the e2e test's.
- **The OS buttons' strip**: no strip of another color behind them; a dialog's backdrop dims it with the window.
- **A screenshot on the clipboard** (written as `keep` does) is an image to other apps (PNG and a DIB).
- **The packaged app** (`npm run package`, not installed: Squirrel's would use the real data folder): a task's
  terminal, a later start on the same data, `KULISA_QUIT`. Its first start after a build may wait for Windows'
  scan of the new files.

### Flaky tests

On the CI a failed test runs once more (`retries`): passing then, it is reported flaky (the report, the run's
annotations) and the job stays green; failing again, it fails the job. A flaky test is a bug, of the test or of
Kulisa, and is fixed, never left to the retry. A fix counts once the failure is reproduced (on the runner's conditions:
Running them, below) and the test then passes a series in a row: `npx playwright test <file> --repeat-each=20`, and
the test alone (`-g`).

## Writing an e2e test

- **Elements are found by their ids and classes**: keep them when a part changes, or change the test with it.
- **The window draws with Vue**, after the change that causes it (a microtask later, before the next frame): assert
  on what it shows with a web-first assertion (`expect(locator).toHaveText(…)`), which waits, rather than reading it
  once. What the tests reach by name in the window (`act`, `state`, `tasks.current`, `window.__dock` …):
  `lib/test-hooks.ts` and the modules that set them.
- **Act as the human or the agent does**: the window's own controls (Playwright's real clicks and keys on `ui`, `act`
  as the renderer sends it), the MCP tools (`call`). Reach into the core (`k.shell.task.createProfile`,
  `k.ensureProfile`) only to set up what another test already covers.
- **Wait for a state, never for time.** A web-first assertion, `expect.poll(() => …)`, or `expect(…).toPass()` for a
  block retried as a whole; `sleep` only where nothing can be waited for (that something did *not* happen, a double
  click's gap), short, with a comment saying so. A screen without a GPU is slower than the author's: a test that
  passes only on a fast one is a race. An assertion that may fail on the CI says what there was instead (its message;
  `termShows(ui, text)` and `termDump(ui)`: the xterm's size, its cursor and its last lines, a wrapped one marked `~`).
- **Before a click, wait until the window is ready for it**: a project or task being shown
  (`!shell.windows[0].switching`, no `loading` class on the root), the panel there, the grid's slide over. A click
  while the window builds another grid is lost, and keys sent while the slide runs go nowhere (dockview hides its
  overlay meanwhile).
- **Menus and dialogs are Reka UI's**: `menuRows`, `choose`, `closeMenu`, `rightClick`, the tasks' bar's `plusMenu`
  (`helpers.ts`) read and drive the open menu (`.menu[data-state="open"]`, shown once it is `.ready`: the pages under
  it are pictures); a dialog is open when its `data-state` is `open`, and closed with its ×. The window has the
  keyboard first (`focusWindow(core, ui)`, which waits until its page has it: a key sent before goes to no page), or
  focus events do not come. A project's row in the + menu opens its submenu on hover; a click on it makes a task.
- **A question Kulisa asks** (`shell.askWhich`) is answered by the driver as `k.answer` says (true by default, each
  test), its dialog clicked once it shows; what was asked is in `k.asked`.
- **Names say what the human sees or gets**, as a sentence ("deleting a task asks first, saying what goes"); the
  comments say why it matters (the bug it once was).
- **Clean up what would disturb the file's other tests** (an extra window or project), and never count on another
  test's cleanup.
- **What it writes stays in its folder** (`files.userData`, `files.project`); nothing in the user's data or home. A
  unit test makes its own temporary folder and removes it (`after`).
- **Budget**: a test that takes over 2 s says why in a comment (git's work, a wait by design). Each action of the
  agent (a click, typing, a key) waits 0.5 s while it is shown in the page (`ghost.ts`, Playwright's
  `showActions`): a test of the agent's tools takes about that per action.

## Dead code

`npm run knip` ([knip](https://knip.dev), under a second) fails on a file nothing loads, an export no other file
imports, or a dependency nothing uses (and one used but not in `package.json`); `npm test` runs it after the unit
tests. Inside a file, TypeScript does the same for names and parameters (`noUnusedLocals`, `noUnusedParameters` in
`tsconfig.json`, `test/tsconfig.json` and `src/renderer/tsconfig.json`, checked by `npm run build`). It runs once a step, when its
code is written and before it is shown to the author, not after every change: midway, what is not called yet is
dead.

- What it finds goes: the file, or the `export` of what only its own file uses. A function made for the next step
  waits for that step.
- knip follows imports from the entry points its plugins know (`package.json`'s `main` and scripts, Vite with Vue,
  `node --test`); what is loaded by a path is listed in `knip.jsonc` (the preload, the window's other pages), each with why. A finding about something used is fixed there, by its entry point; an `ignore` is the
  last resort, with its reason beside it.
- What knip cannot see at all: names that join two sides as strings (IPC channels, CSS classes, the sprite's icons,
  tokens, the keys' table); when one side goes, the other is looked for by hand.

## Layers

`npm run deps` ([dependency-cruiser](https://github.com/sverweij/dependency-cruiser), about a second; `npm run lint`
runs it after ESLint) fails on an import against the layers (CLAUDE.md, Architecture), into a window's cluster past its entries
(docs/ui.md, Clusters), or a cycle. The rules are
`.dependency-cruiser.ts`, each with why.

- Runtime imports only: an `import type` crosses the layers freely, as it is gone once the types are stripped.
- Layers 1 and 2 are lists of `src/main`'s files, layer 3 its folder `kulisa-plugin/`; a file in none of them is the window's
  (layer 4), which may import anything. Below layer 1, the base (`worktrees.ts`, `remotes.ts`, `local.ts`): used by every layer, using
  none of them. `src/shared/` is what the main process and the window both import (`names.ts`, `avatars.ts`,
  `result.ts`); it imports nothing else of `src/`. The window's page never imports `src/main`.
- A Kulisa package (`src/terminal/`; [packages.md](packages.md)) is reached only through its entries
  (`main/index.ts`, `renderer/index.ts`, `ipc.ts`); its `main/` uses of `src/main` only what its line in `packages`
  allows, its `renderer/` nothing of the window; the window takes its `renderer/`, the main process its `main/`.
- A new file of a lower layer goes into its list. An import the rules refuse is moved, not allowed: what the lower
  file needs belongs below (the tab's target id went into `profiles.ts`), or the core says it on `shell.bus` and the
  handle listens (a profile unloaded: the MCP server clears its highlights).
- No cycles, but one: `src/renderer/lib/grid.ts` and `views.ts` call each other's functions only after both have
  loaded.

## Lint

`npm run lint` ([ESLint](https://eslint.org) with [typescript-eslint](https://typescript-eslint.io) and
[eslint-plugin-vue](https://eslint.vuejs.org), about 10 s: it reads the types) checks what `tsc` cannot see;
`npm test` runs it after knip. A few rules, chosen one at a time (`eslint.config.ts`), not the presets: those flag
every `any` from JSON and IPC and the templates' formatting, thousands of places and no bug.

- **A promise is awaited, or `void` says it is not** (`no-floating-promises`): a forgotten `await` in a test makes a
  test that passes without checking. `void` is for what is meant to run on its own: an IPC message the window does
  not wait for, a dialog answered while the test goes on.
- `await` only on a promise (`await-thenable`); no `if (promise)` (`no-misused-promises`, not its void-return part:
  an async callback nobody waits for is fine, its rejection is logged in `app.ts`).
- A `switch` over a union names every case or has a `default` (`switch-exhaustiveness-check`).
- No `as` or `!` TypeScript does not need (`no-unnecessary-type-assertion`; `npx eslint . --fix` removes them). Not in
  the window: it takes `{} as Record<…>` inside `reactive({ … })` for needless, the only type of a store's field.
- Vue's `essential` rules for the templates, without multi-word component names (Kulisa's are one word: `Modal`).

## Upgrading Electron

Kulisa works around two Electron bugs. At every upgrade, check whether each is still needed, and remove it when not.

- Drag regions (`app-region: drag`) of a view's page stay after the page has gone, in a window without a system
  title bar; they took every click over the panes after Teams ([window.md](window.md), "The title bar"). Workaround:
  `app-region: no-drag` in every profile page (`profiles.ts`, `_add`). Electron issue: [electron/electron#54743](https://github.com/electron/electron/issues/54743).
  Check: remove the workaround, open Teams (or a page with `app-region: drag`, then another page) in a pane, and
  click the page with a real mouse (`debug-kulisa` skill). Linux only so far; macOS and Windows draw frameless
  windows their own way (ROADMAP, "Windows and macOS have gaps left").
- A page's alert and confirm in its pane ([profiles.md](profiles.md), "Dialogs"): Electron has no API for them, so Kulisa replaces
  the listener of its internal `-run-dialog` event (`lib/browser/api/web-contents.ts`; `-cancel-dialogs`
  too). Check: that file at the new version's tag; the test of dialogs in `test/e2e/agent-tools.spec.ts` fails when the event is
  gone (Electron's message box comes back instead of the pane's dialog). Ask Electron for a public event
  (`webContents` 'dialog', as `select-bluetooth-device` takes a callback), then use it.

## Workflows

`npm test` checks the CI's workflows (`.github/workflows/`) with [actionlint](https://github.com/rhysd/actionlint)
after knip and ESLint, when it is installed; without it, it says so and goes on. GitHub refuses a whole workflow for one wrong
line, and says so only once it is pushed, with no job run (`runner.temp` in a job's `env`, for one). actionlint is
a Go program, not an npm package (the ones on npm are old wrappers), so it is the developer's to install: a binary of
its releases into a folder on `PATH` (`~/.local/bin`), or `brew install actionlint`. With shellcheck installed it
checks the workflows' `run:` scripts too. The CI's own runs do not have it: the check is before the push.

## Claude Code's checks

For Claude Code sessions working on Kulisa (README, Developing with Claude Code).

**A language server for TypeScript and Vue** (the `kulisa-dev` plugin, `.claude/dev-plugins/`): Claude sees the type
errors of its edits as it makes them, and finds definitions and references through its `LSP` tool instead of searching
the text. `.claude/settings.json` registers and enables it, but Claude Code does not install a project's plugin by
itself: a session without the `LSP` tool installs it, once per `CLAUDE_CONFIG_DIR`, and asks for `/reload-plugins`
(CLAUDE.md, Commands). Why it is built so (its config is JSON, so here):

- Not the official `typescript-lsp`: it has no `.vue` (references from `lib/` missed every use in the components),
  and it answers references from the syntax-only `tsserver`, which knows only the open files (a symbol used in 12
  files had 1 reference); `useSyntaxServer: "never"` sends everything to the full one.
- It runs the project's own `typescript-language-server` and `@vue/typescript-plugin` (devDependencies, the versions of
  `vue-tsc`) from `${CLAUDE_PROJECT_DIR}`, so nothing is installed globally and a worktree uses the repository's
  `node_modules`. The Vue plugin's `location` is not a path Claude Code fills in: `tsserver` finds it next to itself.
- About 700 MB a session. References from `src/` miss the tests (`test/tsconfig.json` loads only once a test file is
  open); `tsc -p test` still checks them.

**A Stop hook** (`.claude/hooks/stop.ts`; how it works, in its comments) runs `npm run lint` and `npm run test:unit`
(about 14 s) before a session ends its turn, when `.ts`, `.mts` or `.vue` files have changes not committed, and sends
the session back with what failed. Not `npm run build` and the e2e tests: the language server shows type errors as
they are made, and the whole suite runs when the work is done (above).

## Running them

When to run what: above. A whole run stops by itself after 20 minutes, a test after 30 s (`playwright.config.ts`), its trace showing the step it hung on. A script run in a window
that closes before its result is back never answers (Electron drops the reply), so a test closes a window without
waiting for the script that closes it (`closeSettings`).

**Looking at the window.** `KULISA_SHOT=/tmp/kulisa.png npm start` saves a screenshot of the whole window, profile
views included, about 4 s after start (`KULISA_SHOT_DELAY` in ms); in a test, `core((k, f) => k.shot(f), file)`. Then read the
PNG: it is how a UI change is checked. On macOS the screen recording permission is the app's that started Kulisa (the
terminal running Claude Code): "On macOS".

**CI** (`.github/workflows/test.yml`): `npm test` on GitHub Actions at every pull request into `develop` or `main` and
every push to `develop` (CLAUDE.md, Releases; into `main` its `version` job checks the version raised; its
`dependencies` job, on pull requests, refuses a new dependency with a known vulnerability or a license not on its list:
`docs/LICENSING.md`), on Ubuntu (with Xvfb
and openbox), Windows and macOS (on the runner's own screen), git given a name (tasks
commit). Every run keeps Playwright Test's report (`playwright-report`, `test-results/junit.xml`) for a week, a run that passed for its flaky tests. All three
pass ("On macOS", "On Windows", above). Flaky, on a loaded machine or the runner (each one fixed is in its
test's comment). Slow but not flaky: deleting a task (git's work, up to 11 s), a
site that never answers (10 s, by design).

On Linux the runner has no desktop: `npm test` runs in a D-Bus session with gnome-keyring made and unlocked, and
`XDG_CURRENT_DESKTOP=GNOME`, else `safeStorage` encrypts nothing and Kulisa keeps no session cookies nor test passwords.
The Kulisas run one at a time: Chromium looks the keyring's key up and, finding none, stores a new one, so two
starting at once on a fresh keyring would each make their own, the keyring keep the last, and the other's restart not
read the session cookies it saved. Its test folders are in the runner's temp, inside the home folder:
a test that reads a path as the window shows it shortens it to `~` as Kulisa does. Lines end in LF on every OS
(`.gitattributes`): else git on Windows checks out CRLF, and a test comparing a file fails.

**The runner's failures, reproduced here.** GitHub's runner is slower (4 cores) and clean (no agents installed, no
desktop): tests that pass on a developer's machine can fail there. Its conditions, locally, to fix them
without a push each time (the keyring's socket needs a short path, so the home folder is a short temporary one, removed
after; the script unlocks the keyring and runs `npm test`):

```sh
H=$(mktemp -d /tmp/kh.XXXX); printf '[user]\n\tname = t\n\temail = t@t\n' > $H/.gitconfig
printf '#!/bin/sh\necho ci | gnome-keyring-daemon --unlock --components=secrets >/dev/null\ncd %s && exec npm test\n' "$PWD" > $H/run.sh; chmod +x $H/run.sh
env -i PATH=$(dirname $(which node)):/usr/bin:/bin HOME=$H TMPDIR=$H XDG_CURRENT_DESKTOP=GNOME taskset -c 0-3 dbus-run-session -- $H/run.sh
```

| File | What |
|---|---|
| `.github/workflows/test.yml` | the same on GitHub Actions at every pull request into `develop` or `main` and push to `develop`, on Linux, Windows and macOS |
| `test/start.ts` | `npm test`: the unit tests, knip, ESLint, actionlint, the window built, then the e2e tests |
| `playwright.config.ts`, `test/e2e/` | the e2e tests, their fixtures, the Kulisa they start (End to end) |
| `test/fixtures/site.ts` | the local test site (sign-in by cookie, dialogs, a board shared by profiles, a site that never answers, a fake GitHub) |
