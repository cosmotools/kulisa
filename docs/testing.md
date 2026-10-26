# Testing

Kulisa's own rules for tests; the rest is [Playwright Test](https://playwright.dev/docs/test-intro)'s and `node:test`'s.
**Read before writing or running a test.**

## What gets a test, and when to run what

- What can break gets a test: a behavior, its logic, a fixed bug. Not a removal or a cosmetic change.
- A bug is first reproduced by a failing test, then fixed.
- **While building, only what the change touches**: `npm run test:unit`; the changed part's e2e files (`npm test --
  e2e <file>…`, or `npx playwright test <file> -g "…"` after `npm run build`); `npx playwright test
  --only-changed=develop` (follows the tests' imports, not Kulisa's code: a change to a shared part, a menu, the grid,
  the focus, takes its features' files too); `KULISA_SHOT` or the author's Kulisa (`run-kulisa`). `npm run knip` once a
  step, not after every change.
- **The full `npm test` (~3 min) once, before the push**, when the author says the work is done; fix and rerun. A
  failure found on the CI costs a push and a run, and only the author can re-run a job. Not for docs alone.

## Two layers

| Layer | Where | For |
|---|---|---|
| Unit | `test/unit/*.test.ts`, `src/<package>/*.test.ts`; plain Node | logic without a window |
| End to end | `test/e2e/*.spec.ts`; the real app against `test/fixtures/site.ts` | what the human or the agent does |

The cheapest layer that shows the behavior. A unit-tested module loads in plain Node (no `node-pty`, no Electron
objects at load); there `'electron'` is only a path, so take objects from the default import (`import electron from
'electron'; const { session } = electron;`), never by name.

## End to end

Setup and what a test gets: `test/e2e/fixtures.ts`. What must not be undone:

- **A file is one Kulisa, its tests independent**: each makes its own state, passes alone and in any order, cleans up
  what would disturb the others (an extra window or project). The test site is the run's own: `SITE`, `PORT`, never a
  literal port. Two runs in one checkout: an `--output` each.
- **Not Playwright's `_electron`**: it forces focus emulation (a minimized window's page never hides) and a light
  scheme. Kulisa is started as the human starts it, with a debugging port on 127.0.0.1 (the one place it has one),
  connected over CDP with `noDefaults`. `test.use({ automation: false })` for what an open port changes
  (`navigator.webdriver`).
- **`core(fn, arg)`** runs in the main process; only JSON crosses (`arg`, never a closure). Over a local socket: not
  stdin (Electron's main process does not read it on Windows), not Node's IPC (`NODE_CHANNEL_FD` crashes DevTools).
- **Profiles' pages through the core, the proxy and MCP**, never Playwright attached (the sign-in pause; it keeps them
  visible). Keys as input events (`k.press`). The keyboard to a page by `profile.focusTab(tab)`, never
  `webContents.focus()` (the focus guard gives it back: [window.md](window.md), Keys).
- **Linux**: a Kulisa per Xvfb with openbox (without a window manager no window list, other focus); never the human's
  focus or clipboard. `npm run test:visible`: on the human's screen.
- **A failure leaves** the window's picture (pages included), the trace, Kulisa's log and Electron's output; a Kulisa
  that never got ready says why.

### On macOS

- The keyboard is the front app's: a click elsewhere during the run fails the focus tests.
- `CMD` (`helpers.ts`, `k.CMD`) is ⌘ there, Ctrl elsewhere; Ctrl+`, Ctrl+Tab and the agent's keys stay Ctrl. ⌘C/⌘V
  in the terminal are the Edit menu's, unreachable by a sent key or `MenuItem.click`: check the row, call
  `webContents.paste()`. Ctrl+T in a terminal is SIGINFO first.
- Screenshots need the screen recording permission of the terminal that started the run; without it the screenshot
  tests skip.

By hand: issue #193.

### On Windows

Needs Git for Windows' `bash` in `PATH` and the VC++ Redistributable (README, Run).

- The shell is PowerShell (`WIN` in `helpers.ts`).
- ConPTY repaints lines: read what the terminal shows (`termText`), not its output.
- A right-click's menu opens on release; the terminal copies and pastes with Ctrl+C / Ctrl+V.
- A folder or file a process holds is not removed: retry until it can; always `removeTree` (`src/main/remove.ts`).
- A refused connection takes Chromium ~2 s.
- node-pty's `AttachConsole failed` on close is harmless.

By hand: issue #194.

### Flaky tests

The CI retries a failure once; passing then, it is reported flaky. On a pull request the run stays green (one test's
flakiness does not hold up unrelated work); on develop it is red, so that it is seen, and gets a `bug` issue. A flaky
test is a bug (the test's or Kulisa's), fixed, never left to the retry. Fixed = reproduced (on the runner's conditions, CI below), then `--repeat-each=20`
passes, alone and with its file.

## Writing an e2e test

- **Playwright's API, not our own**: an action is a locator's (`click`, `dblclick`, `click({ button: 'middle' })`,
  `press`, `fill`, `selectText`, `focus`, `dragTo`), a check a web-first assertion (`toHaveAttribute`, `toHaveCSS`,
  `toHaveText`, `toMatchAriaSnapshot`), never an event dispatched or the DOM read in `evaluate` where one of those does
  it. Own code only where Playwright has none (the main process, a native view, xterm's canvas, "nothing happened"),
  its reason in a comment.
- **Act as the human or the agent**: the window's controls, the MCP tools (`call`). The core only to set up what
  another test covers.
- **Find elements as the human does**: role and name, label, text, an existing id or `data-*` (`data-profile`,
  `data-task`, `data-state`); `data-testid` only when nothing else names it; never a Kulisa class (ESLint
  `kulisa/no-kulisa-classes`; dockview's `dv-…`, xterm's `xterm…` allowed). A state is an attribute the CSS and the
  test both read: ARIA where it means something (`aria-selected`, `aria-current`, `aria-busy`, `aria-disabled`),
  `data-*` otherwise. A row is named by `aria-label`.
- **Wait for a state, never time**: web-first assertions, `expect.poll(() => core(…))`, `toPass()`. ESLint refuses a
  fixed pause; a bounded wait is `upTo(promise, ms)`. A failing assertion says what was there instead (`termShows`,
  `termDump`).
- **"Nothing happened"** is checked after a proof the trigger was handled (`helpers.ts`, `driver.ts`): the `core()`
  call that sent the event; `ipcSettled`; `frames`; `seen`; `echoed`; a log line not written (`k.logged`);
  `k.focusDecided`; a later event of the same kind that shows.
- **Kulisa's waits are moved, not waited**: `k.clock.hold(ms)`, `advance(ms)`, `release()`; a time Kulisa reads is
  dated back; a slow mock waits for the test.
- **Before a click** wait for the window: `k.settled()`, `notLoading`, the grid's slide over.
- **Menus and dialogs are Reka UI's**: a menu's rows by `toMatchAriaSnapshot` (whole: `children: 'equal'` in the
  config), `choose`, `closeMenu`, `rightClick`, `plusMenu`; a menu is shown once `[data-ready]`. `focusWindow(core, ui)`
  first, or no focus events. Kulisa's question is answered in the window that asks it, `answer(page, …)`; a call that
  waits for it is started first and awaited after.
- **Never await a script in a window that it closes** (the reply is dropped): `closeSettings`.
- Names say what the human sees, as a sentence; comments say why.
- Writes stay in the test's folder (`files.userData`, `files.project`); a unit test removes its temporary folder.
- Over 2 s says why in a comment; each agent action is shown 0.5 s.

**Looking at the window**: `KULISA_SHOT=/tmp/kulisa.png npm start` (whole window, pages included, ~4 s after start;
`KULISA_SHOT_DELAY`); in a test `core((k, f) => k.shot(f), file)`. Read the PNG to check a UI change.

## Dead code

`npm run knip`. What it finds goes (the file, or the `export`); code for the next step waits for it. A path-loaded
file is an entry in `knip.jsonc` with why; `ignore` last, with its reason. Invisible to knip: names joined as strings
(IPC channels, CSS classes, sprite icons, the keys' table): check the other side by hand.

## Layers

`npm run deps` (in `npm run lint`; rules with reasons in `.dependency-cruiser.ts`). A new lower-layer file goes into
its list. A refused import is moved, not allowed: the need goes below, or the core says it on `shell.bus`.

## Lint

`npm run lint`: rules picked one by one in `eslint.config.ts`, no presets (thousands of `any` findings, no bugs). A
promise is awaited, or `void` says it runs on its own.

## Upgrading Electron

Two Electron bugs are worked around; at each upgrade check whether each is still needed, and remove it if not.

- A view page's drag regions outlive the page in a frameless window and take clicks over the panes
  ([electron#54743](https://github.com/electron/electron/issues/54743); [window.md](window.md), The title bar).
  Workaround: `app-region: no-drag` in every profile page (`profiles.ts`, `_add`). Check: remove it, open Teams (or a
  page with `app-region: drag`, then another) in a pane, click with a real mouse (`debug-kulisa`). Linux only so far.
- A page's alert/confirm in its pane ([profiles.md](profiles.md), Dialogs): Kulisa replaces the listener of Electron's
  internal `-run-dialog` (and `-cancel-dialogs`; `lib/browser/api/web-contents.ts`). Check: that file at the new tag;
  the dialogs test in `agent-tools.spec.ts` fails when it is gone. Ask Electron for a public event.

## Workflows

`npm test` runs [actionlint](https://github.com/rhysd/actionlint) on `.github/workflows/` when installed (GitHub
refuses a whole workflow for one bad line, only after the push). A Go binary: on `PATH`, or `brew install actionlint`;
with shellcheck it checks `run:` scripts too.

## Claude Code's checks

- **LSP** (`kulisa-dev` plugin, `.claude/dev-plugins/`): type errors while editing, the `LSP` tool for references. Not
  auto-installed: a session without the `LSP` tool installs it and asks for `/reload-plugins` (CLAUDE.md, Commands).
  Not the official `typescript-lsp`: no `.vue`, and references from the syntax-only `tsserver` (`useSyntaxServer:
  "never"` here). The project's own server and Vue plugin, nothing global. ~700 MB; references from `src/` miss the
  tests.
- **Stop hook** (`.claude/hooks/stop.ts`): `npm run lint` and `npm run test:unit` before a turn ends, when `.ts`,
  `.mts` or `.vue` files have uncommitted changes.

## CI

`.github/workflows/test.yml`: `npm test` on Ubuntu, Windows and macOS for every pull request into `develop` or `main`
and push to `develop`. Per OS: `checks (<os>)`, `e2e (<os>, i/3)`, and `test (<os>)`, the required check. The merged
report is kept a week, passing runs too (for flakes). Slow by design: deleting a task (git, ≤11 s), a site that never
answers (10 s).

- Linux: e2e in a D-Bus session with gnome-keyring unlocked and `XDG_CURRENT_DESKTOP=GNOME` (else `safeStorage`
  encrypts nothing). Test folders are under home: paths show as `~`.
- macOS and Windows runners are 1024×768; the CI sets 1920×1080.
- LF everywhere (`.gitattributes`), else file comparisons fail on Windows.

**The runner's conditions locally** (4 cores, no agents, no desktop; a short home for the keyring's socket):

```sh
H=$(mktemp -d /tmp/kh.XXXX); printf '[user]\n\tname = t\n\temail = t@t\n' > $H/.gitconfig
printf '#!/bin/sh\necho ci | gnome-keyring-daemon --unlock --components=secrets >/dev/null\ncd %s && exec npm test\n' "$PWD" > $H/run.sh; chmod +x $H/run.sh
env -i PATH=$(dirname $(which node)):/usr/bin:/bin HOME=$H TMPDIR=$H XDG_CURRENT_DESKTOP=GNOME taskset -c 0-3 dbus-run-session -- $H/run.sh
```

### Speed

- **Workers**: on Linux min(cores/2, free RAM/1.5 GB, 4) (a test Kulisa peaks at ~1480 MB; `playwright.config.ts`,
  `--workers` overrides). One on macOS, Windows and with `KULISA_VISIBLE`: one screen and focus, two Kulisas would take
  each other's keys.
- **The keyring's key is made once** in `global-setup.ts` (`keyring.ts`, Linux): Kulisas starting together on an empty
  keyring would each store their own, and a restart would not read its cookies.
- **CI shards**: checks once per OS; e2e in three shards per OS, each its own runner, screen and focus (the only safe
  parallelism on macOS and Windows; Linux shards also use workers). Files go to shards by time, not test count as
  `--shard` does (`KULISA_SHARD=i/n`, `shards.ts`, seconds per file in `timings.json`; an unknown file counts as the
  mean). A file is never split, so the slowest file bounds a shard: a much heavier one is split by topic
  (`projects*.spec.ts`, `tasks*.spec.ts`). `test (<os>)` keeps the required name, passes only when its OS's checks and
  shards do, and merges their blob reports.
- **Caches** (a shard's setup under a minute): npm, Electron's download (by its version in `package-lock.json`), the
  apt .deb files (the Ubuntu mirror is at times slow; a cache of installed packages loses `gnome-keyring-daemon`).
  macOS's `displayplacer` comes from brew each time.
- **Not used**: an own runner image (paid larger runners; Docker is Linux only); a self-hosted runner (public repo: a
  fork's PR would run code on it); several workers on one macOS/Windows screen.
- **Tuning**: refresh `timings.json` from a CI `junit.xml` (each file's slowest OS) when shards drift apart; add a
  shard while a shard's tests take much longer than its setup; workers from a test Kulisa's RSS (`ps -eo
  pid,rss,comm`, its `electron` processes summed). A flake only with workers is fixed at its cause, never by fewer
  workers.
