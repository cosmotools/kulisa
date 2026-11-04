# Testing

Test harness, platform constraints and CI implementation. API references:
[Playwright Test](https://playwright.dev/docs/test-intro) and [node:test](https://nodejs.org/api/test.html).

## Two layers

| Layer | Where | For |
|---|---|---|
| Unit | `test/unit/*.test.ts`, `src/<package>/*.test.ts`; plain Node | logic without a window |
| End to end | `test/e2e/*.spec.ts`; the real app against `test/fixtures/site.ts` | what the human or the agent does |

Unit modules load in plain Node, where `electron` is the executable path and has no named Electron-object exports.
Main modules use the default import (`import electron from 'electron'; const { session } = electron;`); native
`node-pty` and Electron objects need the app runtime.

## End to end

Fixtures and app lifecycle live in `test/e2e/fixtures.ts`:

- **A file is one Kulisa** with its own data folder. The run's test site address and port are `SITE` and `PORT`.
  Playwright's `--output` selects the result directory for a run.
- Vite clears the renderer output before writing it, so a concurrent build removes files used by an active e2e run.
- **The fixture starts Electron directly** and connects over CDP with `noDefaults` on 127.0.0.1. Playwright's
  `_electron` forces focus emulation (a minimized window's page never hides) and a light scheme.
  `test.use({ automation: false })` disables the debugging port for checks affected by `navigator.webdriver`.
- **`core(fn, arg)`** runs in the main process; only JSON crosses (`arg`, never a closure). Over a local socket: not
  stdin (Electron's main process does not read it on Windows), not Node's IPC (`NODE_CHANNEL_FD` crashes DevTools).
- **Profiles' pages use the core, proxy and MCP** to retain the sign-in pause and visible automation. `k.press` sends
  key input; `profile.focusTab(tab)` gives a page the keyboard. Direct `webContents.focus()` is reversed by the
  focus guard ([window.md](window.md), Keys).
- **Linux**: a Kulisa per Xvfb with openbox (without a window manager no window list, other focus), separate from the
  human's display. `npm run test:visible`: on the human's screen. By hand (Wayland, packaged): issue #205.
- **A failure leaves** the window's picture (pages included), the trace, Kulisa's log and Electron's output; a Kulisa
  that never got ready says why.

### On macOS

- The keyboard is the front app's: a click elsewhere during the run fails the focus tests.
- `CMD` (`helpers.ts`, `k.CMD`) is ⌘ there, Ctrl elsewhere; Ctrl+`, Ctrl+Tab and the agent's keys stay Ctrl. ⌘C/⌘V
  in the terminal are the Edit menu's, unreachable by a sent key or `MenuItem.click`; terminal paste uses
  `webContents.paste()`. Ctrl+T in a terminal is SIGINFO first.
- Screenshots need the screen recording permission of the terminal that started the run; without it the screenshot
  tests skip.

By hand: issue #193.

### On Windows

Needs Git for Windows' `bash` in `PATH` and the VC++ Redistributable (README, Run).

- The shell is PowerShell (`WIN` in `helpers.ts`).
- ConPTY repaints lines; `termText` reads the rendered terminal screen.
- A right-click's menu opens on release; the terminal copies and pastes with Ctrl+C / Ctrl+V.
- A folder or file held by a process remains locked. `removeTree` (`src/main/remove.ts`) supports deferred cleanup.
- A refused connection takes Chromium ~2 s.
- node-pty's `AttachConsole failed` on close is harmless.

By hand: issue #194.

### Flaky tests

The CI retries a failure once; a subsequent pass is reported as flaky. A pull-request run stays green after that
retry, while a develop run reports flakiness as a failure.

## Window captures

`KULISA_SHOT=/tmp/kulisa.png npm start` saves the whole window, including embedded pages, after about four seconds.
`KULISA_SHOT_DELAY` changes the delay; `core((k, f) => k.shot(f), file)` captures during an e2e run.

## Dead code

Run `npm run knip`; remove unused files/exports. Declare path-loaded entries in `knip.jsonc` with reasons; use
`ignore` only as a justified last resort. Manually check string-linked IPC names, CSS classes and key commands.

## Layers

`npm run deps` (in `npm run lint`; rules with reasons in `.dependency-cruiser.ts`). A new lower-layer file goes into
its list. Kulisa package boundaries include type imports; cycle checks concern runtime dependencies. A refused import is moved, not allowed: the need goes below, or the core says it on `shell.bus`.

## Lint

`npm run lint` runs the selected rules in `eslint.config.ts` and dependency checks. Await promises or explicitly
`void` independent work. Window components use shipped shadcn, Lucide and theme colors ([ui.md](ui.md)).

## Upgrading Electron

Two Electron workarounds have platform-specific reproductions:

- A view page's drag regions outlive the page in a frameless window and take clicks over the panes
  ([electron#54743](https://github.com/electron/electron/issues/54743); [window.md](window.md), The title bar).
  Workaround: `app-region: no-drag` in every profile page (`profiles.ts`, `_add`). The Linux reproduction involves
  navigating from a page with `app-region: drag` (such as Teams) to another page, then clicking with a real mouse.
- A page's alert/confirm in its pane ([profiles.md](profiles.md), Dialogs): Kulisa replaces the listener of Electron's
  internal `-run-dialog` (and `-cancel-dialogs`; `lib/browser/api/web-contents.ts`). The pane-dialog scenario in
  `agent-tools.spec.ts` covers the integration with these internal events.

## Workflows

`npm test` runs [actionlint](https://github.com/rhysd/actionlint) on `.github/workflows/` when installed (GitHub
refuses a whole workflow for one bad line, only after the push). A Go binary: on `PATH`, or `brew install actionlint`;
with shellcheck it checks `run:` scripts too.

## Code analysis

- Use the project's installed TypeScript to check the main process and scripts, tests, and renderer:

  ```sh
  node node_modules/typescript/bin/tsc -p .
  node node_modules/typescript/bin/tsc -p test
  node node_modules/typescript/bin/tsc --noEmit -p src/renderer
  ```

  These are the type checks in `npm run build`, without Vite's build. A passing type check does not prove that a
  text search found every caller.
- **Codex and other sessions without a language-server tool**: follow `AGENTS.md`, Code intelligence. The
  repository's `kulisa-dev` plugin configures Claude Code; installing it does not provide a tool in another agent.

## Claude Code's checks

- **LSP** (`kulisa-dev` plugin, `.claude/dev-plugins/`): type errors while editing, the `LSP` tool for references. Not
  auto-installed: in a Claude Code session without the `LSP` tool, install it with
  `claude plugin install kulisa-dev@kulisa-dev --scope project`, then ask for `/reload-plugins`.
  TypeScript only (`.ts`, `.mts`, `.tsx`). Not the official `typescript-lsp`: its references come from the
  syntax-only `tsserver` (`useSyntaxServer: "never"` here). The project's own server, nothing global. ~700 MB;
  references from `src/` miss the tests.
- **Stop hook** (`.claude/hooks/stop.ts`): `npm run lint` before a turn ends, when `.ts`,
  `.mts` or `.tsx` files have uncommitted changes.

## CI

`.github/workflows/test.yml`: `npm test` on Ubuntu, Windows and macOS for every pull request into `develop` or `main`
and push to `develop`. Per OS: `checks (<os>)`, `e2e (<os>, i/3)`, and `test (<os>)`, the required check. The merged
report is kept a week, passing runs too (for flakes). Slow by design: deleting a task (git, ≤11 s), a site that never
answers (10 s).

- Linux: e2e in a D-Bus session with gnome-keyring unlocked and `XDG_CURRENT_DESKTOP=GNOME` (else `safeStorage`
  encrypts nothing). Test folders are under home: paths show as `~`.
- Linux's checks install `rpm` for the RPM maker's fixture build (`forge.test.ts`); locally it skips without `rpmbuild`.
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
  shards do, and merges their blob reports. Partial reruns use each job’s latest result across attempts; the aggregate
  retries transient API failures and rejects failed, pending or missing jobs.
- **Caches** (a shard's setup under a minute): npm, Electron's download (by its version in `package-lock.json`), the
  apt .deb files (the Ubuntu mirror is at times slow; a cache of installed packages loses `gnome-keyring-daemon`).
  macOS's `displayplacer` comes from brew each time.
- **Not used**: an own runner image (paid larger runners; Docker is Linux only); a self-hosted runner (public repo: a
  fork's PR would run code on it); several workers on one macOS/Windows screen.
- **Measurements**: `timings.json` records each file's slowest OS from CI's `junit.xml`; process RSS comes from
  `ps -eo pid,rss,comm`, summed across a test Kulisa's Electron processes.
