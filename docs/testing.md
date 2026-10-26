# Testing

What gets a test, when to run which, and what of Kulisa's tests is its own: the rest is
[Playwright Test](https://playwright.dev/docs/test-intro)'s and `node:test`'s. **Read this before writing or running a
test.**

## What gets a test, and when to run what

- **What can break comes with a test**: a behavior, its logic, a bug fixed. Not a removal, nor a cosmetic change (a
  symbol, a label, a color): ask what regression a test would catch; none, no test.
- **A bug is first reproduced by a failing test**, then fixed.
- **While building**: `npm run test:unit` (a second), some e2e files (`npm test -- e2e <file>…`, or `npx playwright
  test <file> -g "…"` after `npm run build`), a screenshot (`KULISA_SHOT`, below) or the author's running Kulisa,
  restarted with the change (the `run-kulisa` skill). `npm run knip` once a step, when its code is written, not after
  every change (midway, what is not called yet is dead).
- **The full suite (`npm test`, minutes) runs once, when the author says the work is done** ("всё ок", "commit"),
  before the commit; fix what fails and run it again. Not for a change to documentation alone: the pull request's CI
  runs it anyway.

## Two layers

| Layer | Where | For |
|---|---|---|
| Unit | `test/unit/*.test.ts`, a Kulisa package's in its folder (`src/<package>/*.test.ts`); plain Node | logic that needs no window |
| End to end | `test/e2e/*.spec.ts`; the real app against the local test site (`test/fixtures/site.ts`) | everything the human or the agent does |

A check goes into the cheapest layer that can show the behavior. A module a unit test needs must load in plain Node
(no `node-pty`, no Electron objects used at load). There `'electron'` is only the path of Electron's binary, so such a
module takes Electron's objects from the module, not by name (`import electron from 'electron'; const { session } =
electron;`): an ES module importing `session` by name does not load.

## End to end

How a test is set up and what it gets: `test/e2e/fixtures.ts`, its comments. What holds and must not be undone:

- **A file is one Kulisa, its tests independent**: each makes what it needs and passes alone and in any order, and
  cleans up what would disturb its file's others (an extra window or project). The test
  site is the run's own, on a free port (`SITE`, `PORT` from `helpers.ts`, never a literal port). Two runs in one
  checkout each take an `--output` of their own.
- **Kulisa started as the human starts it**, not by Playwright's `_electron`, which forces focus emulation on every
  page (a minimized window's page never hides) and a light color scheme. The tests connect over CDP with `noDefaults`
  on a debugging port on 127.0.0.1: the one place Kulisa runs with one. What an open port changes in the pages
  (`navigator.webdriver`) is tested with `test.use({ automation: false })`.
- **`core(fn, arg)` runs in the main process**: only JSON crosses, so what it needs comes by `arg`, never by a
  closure. It goes over a local socket the test listens on: not Electron's stdin, which its main process does not read
  on Windows, nor Node's IPC channel, whose `NODE_CHANNEL_FD` Chromium's children inherit and DevTools' renderer
  crashes on.
- **Profiles' pages are driven through the core, the proxy and MCP**, never by Playwright attached to them: they are
  the agent's, behind the sign-in pause, and Playwright's attachment keeps them visible (CLAUDE.md, Hard-won facts).
  Keys go into a page as input events (`k.press`), which Kulisa's keys see first. A page is given the keyboard with
  `profile.focusTab(tab)`, never `webContents.focus()`: Kulisa takes that for the page's own and gives the keyboard
  back ([window.md](window.md), Keys).
- **On Linux each Kulisa has a screen of its own** (Xvfb with openbox: without a window manager, windows are not listed
  for screenshots and focus differs from a desktop); the tests never take the human's focus or clipboard.
  `npm run test:visible` shows them on the human's screen. One worker: on macOS and Windows the Kulisas share one
  screen.
- **A failed test leaves** the window as the screen shows it (profiles' pages included), the trace, Kulisa's log and
  Electron's output, in the report; a Kulisa that never got ready says why in the error.

### On macOS

- **The keyboard is the app in front's**: the tests' app is brought to the front; a click elsewhere during the run takes
  it back, and tests waiting for the focus fail.
- **⌘ for Kulisa's keys**: `CMD` (`helpers.ts`, `k.CMD`) is ⌘ there, Ctrl elsewhere; Ctrl+`, Ctrl+Tab and the agent's
  keys stay Ctrl. ⌘C and ⌘V in the terminal are the Edit menu's, which neither a key sent into a page nor
  `MenuItem.click` reaches: the test checks the row and does what it does (`webContents.paste()`). Ctrl+T in a
  terminal is the tty's SIGINFO first.
- **Screenshots need the screen recording permission** of the app that started the run (the terminal), not
  Electron's: without it a failed test's picture is the window's page alone, and the screenshot tests skip.

What only a human can check there: issue #193.

### On Windows

Git for Windows' `bash` in `PATH` (the test agent and the fake installed agent run with it) and the Visual C++
Redistributable (README, Run).

- **The user's shell is PowerShell**: the terminal tests type its commands (`WIN` in `helpers.ts`).
- **ConPTY redraws the screen** (a line sent again as it repaints, padded after a resize): a test reads what the
  terminal shows (`termText`), not its output.
- **A right-click's menu opens on the release**; the terminal copies and pastes with Ctrl+C / Ctrl+V (`WIN`).
- **A folder a process is in, or a file it holds, is not removed**: a test waits until it can; every folder goes with
  `removeTree` (`src/main/remove.ts`), the tests' too (`rmSync` refuses git's read-only files and follows junctions).
- **Chromium is told a connection is refused after about 2 s**: "at once" allows for it.
- node-pty's `AttachConsole failed` as a terminal closes is its own race, harmless.

What only a human can check there: issue #194.

### Flaky tests

On the CI a failed test runs once more: passing then, it is reported flaky and the job stays green. A flaky test is a
bug, of the test or of Kulisa, fixed, never left to the retry. A fix counts once the failure is reproduced (on the
runner's conditions: CI, below) and the test passes `--repeat-each=20`, alone and with its file.

## Writing an e2e test

- **Act as the human or the agent does**: the window's own controls, the MCP tools (`call`). Reach into the core only
  to set up what another test already covers.
- **Find an element as the human does**: its role and name, its label, its text, an id or a `data-*` the code already
  has (`data-profile`, `data-task`, `data-state`); a `data-testid` only where nothing else tells it; never a Kulisa CSS
  class (ESLint's `kulisa/no-kulisa-classes`; dockview's `dv-…` and xterm's `xterm…` are theirs). A state is an
  attribute that the CSS and the test both read: ARIA's where it has a meaning (`aria-selected`, `aria-current`,
  `aria-busy`, `aria-disabled`), `data-*` otherwise. A row with more than its name in it is named by its label
  (`aria-label`, read by `getByRole(…, { name })`).
- **Wait for a state, never for time**: a web-first assertion, `expect.poll(() => core(…))`, `toPass()`. ESLint refuses
  a fixed pause in `test/e2e`; a wait with an end is `upTo(promise, ms)`. A screen without a GPU is slower: a test
  that passes only on a fast one is a race. An assertion that may fail on the CI says what there was instead
  (`termShows`, `termDump`).
- **That something did not happen** is checked once a proof shows what would have made it is done (`helpers.ts`,
  `driver.ts`): the `core()` call that sent a key or mouse event (decided as it is sent); the window's channel gone
  there and back (`ipcSettled`), two frames on (`frames`); a page's event handled (`seen`); a mark typed after into
  the terminal echoed (`echoed`); the core's log line not written (`k.logged`); the focus guard's decision about a
  page's focus logged (`k.focusDecided`); a later event of the same kind that does show.
- **A time Kulisa waits is the test's to move**: `k.clock.hold(ms)`, `advance(ms)`, `release()` for the main process's
  long timers; a time Kulisa reads is dated back; a slow mock waits for the test to let it go.
- **Before a click, wait until the window is ready**: no task being shown (`k.settled()`, the grid's region not
  `aria-busy`: `notLoading`), the grid's slide over. A click while the window builds another grid is lost.
- **Menus and dialogs are Reka UI's**: `menuRows`, `choose`, `closeMenu`, `rightClick`, `plusMenu` (`helpers.ts`); a menu
  is shown once `[data-ready]` (the pages under it are pictures). The window has the keyboard first
  (`focusWindow(core, ui)`), or focus events do not come. A question Kulisa asks is answered as `k.answer` says.
- **A script run in a window that closes before its result is back never answers**: close a window without waiting
  for the script that closes it (`closeSettings`).
- **Names say what the human sees or gets**, as a sentence; the comments say why it matters.
- **What it writes stays in its folder** (`files.userData`, `files.project`). A unit test removes its temporary folder.
- **Budget**: a test over 2 s says why in a comment. Each agent action waits 0.5 s while it is shown in the page.

**Looking at the window.** `KULISA_SHOT=/tmp/kulisa.png npm start` saves a screenshot of the whole window, profile
views included, about 4 s after start (`KULISA_SHOT_DELAY` in ms); in a test, `core((k, f) => k.shot(f), file)`. Read
the PNG: it is how a UI change is checked.

## Dead code

`npm run knip` ([knip](https://knip.dev)). What it finds goes: the file, or the `export` of what only its own file
uses; a function made for the next step waits for that step. What is loaded by a path is an entry in `knip.jsonc`,
with why; an `ignore` is the last resort, with its reason. What knip cannot see: names that join two sides as strings
(IPC channels, CSS classes, the sprite's icons, the keys' table); when one side goes, the other is looked for by hand.

## Layers

`npm run deps` ([dependency-cruiser](https://github.com/sverweij/dependency-cruiser), in `npm run lint`); its rules,
each with why, in `.dependency-cruiser.ts`. A new file of a lower layer goes into its list. An import the rules refuse
is moved, not allowed: what the lower file needs belongs below, or the core says it on `shell.bus` and the handle
listens.

## Lint

`npm run lint` (ESLint with typescript-eslint and eslint-plugin-vue): rules chosen one at a time in
`eslint.config.ts`, not the presets (thousands of findings on JSON's and IPC's `any`, and no bug). A promise is awaited,
or `void` says it is meant to run on its own.

## Upgrading Electron

Kulisa works around two Electron bugs. At every upgrade, check whether each is still needed, and remove it when not.

- Drag regions (`app-region: drag`) of a view's page stay after the page has gone, in a window without a system
  title bar; they took every click over the panes after Teams ([window.md](window.md), "The title bar"). Workaround:
  `app-region: no-drag` in every profile page (`profiles.ts`, `_add`). Electron issue: [electron/electron#54743](https://github.com/electron/electron/issues/54743).
  Check: remove the workaround, open Teams (or a page with `app-region: drag`, then another page) in a pane, and
  click the page with a real mouse (`debug-kulisa` skill). Linux only so far.
- A page's alert and confirm in its pane ([profiles.md](profiles.md), "Dialogs"): Electron has no API for them, so
  Kulisa replaces the listener of its internal `-run-dialog` event (`lib/browser/api/web-contents.ts`;
  `-cancel-dialogs` too). Check: that file at the new version's tag; the dialogs test in `agent-tools.spec.ts` fails
  when the event is gone. Ask Electron for a public event, then use it.

## Workflows

`npm test` checks `.github/workflows/` with [actionlint](https://github.com/rhysd/actionlint) when it is installed:
GitHub refuses a whole workflow for one wrong line, and says so only once it is pushed. It is a Go program, the
developer's to install (a release binary on `PATH`, or `brew install actionlint`); with shellcheck it checks the
`run:` scripts too.

## Claude Code's checks

**A language server for TypeScript and Vue** (the `kulisa-dev` plugin, `.claude/dev-plugins/`): type errors as edits
are made, and the `LSP` tool for definitions and references. Claude Code does not install a project's plugin by
itself: a session without the `LSP` tool installs it and asks for `/reload-plugins` (CLAUDE.md, Commands). Why it is
built so (its config is JSON, so here): the official `typescript-lsp` has no `.vue` and answers references from the
syntax-only `tsserver`, which knows only the open files (`useSyntaxServer: "never"` here); it runs the project's own
`typescript-language-server` and `@vue/typescript-plugin`, so nothing is installed globally. About 700 MB a session;
references from `src/` miss the tests.

**A Stop hook** (`.claude/hooks/stop.ts`) runs `npm run lint` and `npm run test:unit` before a session ends its turn
when `.ts`, `.mts` or `.vue` files have changes not committed, and sends it back with what failed.

## CI

`.github/workflows/test.yml`: `npm test` on Ubuntu, Windows and macOS at every pull request into `develop` or `main`
and every push to `develop`; its report kept a week, a passing run's too, for its flaky tests. Slow but not flaky:
deleting a task (git, up to 11 s), a site that never answers (10 s).

- **Linux has no desktop there**: `npm test` runs in a D-Bus session with gnome-keyring unlocked and
  `XDG_CURRENT_DESKTOP=GNOME`, else `safeStorage` encrypts nothing. The Kulisas run one at a time: two starting at once
  on a fresh keyring would each store their own key, and one's restart would not read its saved cookies. Its test
  folders are inside the home folder: a path as the window shows it is shortened to `~`.
- **macOS and Windows runners have 1024×768**: the CI sets 1920×1080.
- **Lines end in LF on every OS** (`.gitattributes`), else a test comparing a file fails on Windows.

**The runner's failures, reproduced here.** The runner is slower (4 cores) and clean (no agents, no desktop). Its
conditions, locally (the keyring's socket needs a short path, so the home folder is a short temporary one):

```sh
H=$(mktemp -d /tmp/kh.XXXX); printf '[user]\n\tname = t\n\temail = t@t\n' > $H/.gitconfig
printf '#!/bin/sh\necho ci | gnome-keyring-daemon --unlock --components=secrets >/dev/null\ncd %s && exec npm test\n' "$PWD" > $H/run.sh; chmod +x $H/run.sh
env -i PATH=$(dirname $(which node)):/usr/bin:/bin HOME=$H TMPDIR=$H XDG_CURRENT_DESKTOP=GNOME taskset -c 0-3 dbus-run-session -- $H/run.sh
```
