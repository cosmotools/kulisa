# Testing

How Kulisa's tests are built and how to write one. **Read this before writing a test.** Every behavior change comes
with a test (CLAUDE.md); a bug is first reproduced by a failing test, then fixed.

## Two layers

| Layer | Where | Runs in | For |
|---|---|---|---|
| Unit | `test/unit/*.test.ts` (`node:test`) | plain Node, about a second: `npm run test:unit` | logic that needs no window: names, the data folder, a task's profiles in order, the agents' files |
| End to end | `test/*.ts` (`run.ts`) | the real app, against the local test site (`fixtures/site.ts`) | everything the human or the agent does: the window, profiles' pages, MCP tools, restarts |

A check goes into the cheapest layer that can show the behavior: a rule about names is a unit test; that the name
field leaves characters out as they are typed is end to end. A module a unit test needs must load in plain Node (no
`node-pty`, no Electron objects used at load); when it cannot, the check stays end to end. There `'electron'` is only
the path of Electron's binary, so such a module takes Electron's objects from the module, not by name (`import
electron from 'electron'; const { session } = electron;`): an ES module importing `session` by name does not load.

## End to end: groups

`npm test` runs the unit tests, knip (Dead code, below), ESLint (Lint, below), actionlint (Workflows, below), builds the window (`npm run build`: its types checked, then Vite), then the groups of
e2e files in parallel (`GROUPS` in `start.ts`):

- **A group is one app, its files in order**: later files build on what earlier ones left (profiles, sign-ins,
  projects), as the human's day does. Then the app is restarted in the same folder and the group's restart file
  checks what must survive (`restart-<group>.ts`).
- **Groups are independent**: each has its own folder (`$KULISA_TEST_ROOT`,
  `/tmp/kulisa-test-<checkout>-<hash>/<group>`), its own MCP port, on Linux its own screen; only the test site is
  shared, the run's own on a free port (`$KULISA_TEST_SITE`; in a test `SITE` and `PORT` from `helpers.ts`, never a
  literal port). So runs from several worktrees go at once (CLAUDE.md, Conventions): each checkout its folder, each
  run its site. A group that does not start from nothing starts from a fixture file (`setup.ts`: the profiles and
  the agent's session the first group makes on its way).
- **A new file** goes into the group whose state it needs; a new group when a file would make a group much longer
  than the others (the run takes as long as the longest group: today about a minute). Give it a `setup` fixture
  rather than a dependency on another group.
- One group: `npm test -- tasks`. Its folder is removed when it passes, kept to look at when it fails.

**On Linux the tests run on a screen of their own** (Xvfb, with the openbox window manager: without one windows are
not listed for screenshots and focus differs from a desktop), so they never take the human's focus or clipboard.
`npm run test:visible` runs them on the human's screen, one group after another; so do macOS and Windows, where
there is no screen of their own (in parallel, the groups' windows took each other's focus: 2026-10-16). No GPU there:
`--ignore-gpu-blocklist` lets WebGL run on Chromium's software renderer. macOS and Windows run them on the screen.

### On macOS

Run from a terminal, as anywhere; what differs there (2026-10-16):

- **The keyboard is the active app's.** macOS gives the keys and the focus only to the windows of the app in front,
  and the run starts from another (the terminal): `run.ts` brings the tests' app to the front (`app.focus({ steal:
  true })`). A click elsewhere during the run takes it back, and tests waiting for the focus fail: let it run.
- **⌘ for Kulisa's keys** (CommandOrControl in `keys.ts`): `CMD` in `helpers.ts` is ⌘ there, Ctrl elsewhere; Ctrl+`,
  Ctrl+Tab and the agent's keys stay Ctrl. ⌘C and ⌘V in the terminal are the Edit menu's, which a key sent into a
  page does not reach, nor `MenuItem.click` (the system runs those roles): the test checks the row is there and does
  what it does (`webContents.paste()`). Ctrl+T in a terminal is the tty's status key (SIGINFO) before it is the agent's.
- **No screenshots without the screen recording permission**, which macOS checks on the app that started the run
  (the terminal), not on Electron: `shot` in `helpers.ts` says so instead and goes on; the test of the screenshot itself
  is skipped with the reason. Granted to the terminal, they are taken.
- **Its temporary folders are named through a symlink** (`/var` is `/private/var`), where git answers with the real
  path: what the tests found in `repoOf` (`worktrees.ts`).
- A laptop's screen is narrower than Xvfb's 1920 px: a test needing room beside the window makes it narrower. GitHub's
  runner has 1024×768, too small for the tests' windows: the CI sets its virtual screen to 1920×1080 (displayplacer).
- **Motion is on whatever the OS says** (`force-prefers-no-reduced-motion` in `run.ts`): GitHub's macOS runner reduces
  motion, and the tests of a tab growing in and the grid's slide waited for what never moved there. Reduced motion is
  checked where Kulisa does something else for it, emulated (`Emulation.setEmulatedMedia`).

What the tests cannot do there was checked by hand on the author's Mac (macOS 15, Apple silicon; 2026-10-16 and 17),
and is not checked again until something it depends on changes (an OS, an Electron, the part's code):

- **The agent in the user's zsh** (`startTerminal` run alone in Electron, with their `.zshrc`): with no `SHELL` and the
  system's `PATH`, as from the Dock, the login zsh finds `claude`; direnv's hook loads the project's `.envrc`, and the
  account's `CLAUDE_CONFIG_DIR` typed before the command wins over the one it sets; arguments with spaces, `'`, `$`,
  `*`, `!` and JSON arrive as they were; the shell stays after the agent exits. A task closed and opened again resumes
  its conversation (`claude --resume`).
- **Sign-ins**: Google, GoDaddy and Microsoft (profiles.md, What sites see); session cookies encrypted with the
  Keychain (`safeStorage`: Chromium's `v10`, "kulisa Safe Storage").
- **Pages**: Teams' takes every click, its top strip too (the drag regions' workaround in: ROADMAP, Workarounds of
  Electron bugs).
- **Keys** with a real keyboard: ⌘T, ⌘W, ⌘L, ⌘[ / ⌘] in a page are Kulisa's, not the site's; Ctrl+C and Ctrl+R stay the
  terminal's; ⌘C / ⌘V in the terminal.
- **Menus** with a trackpad: a right-click opens at the pointer and its release chooses nothing; press, drag and let go
  on a row chooses it; another app clicked closes a menu.
- **The theme** System follows macOS's Appearance as it changes.
- **Dictation**: the right ⌘ held records in Claude Code and puts the text in its input (once `voiceEnabled` was given
  too: agents/claude.ts); the microphone asked for Electron, which runs Kulisa from source.
- **The window**: the traffic lights centered in the bar at the zoom it is made at, moved as it changes, and taking a
  click (window.md, The title bar); the bar's empty part drags the window and a double click zooms it; New Project's Browse… is the system's folder dialog.
- **A build made there** (`npm run package`, unsigned, ad hoc): it starts by `open`; the first start is the empty
  window with the welcome; the Kulisa plugin and the skill sit outside the asar, node-pty's `spawn-helper` is
  executable, the icon is Kulisa's.
- Screenshots of a Kulisa started by `open` need the permission on Electron.app itself: macOS took it back when
  Electron was upgraded (ad hoc signed, a new binary is a new app to it), and it was granted again.

## Writing an e2e test

- **The window draws with Vue**, after the change that causes it (a microtask later, before the next frame): wait
  for what it shows rather than reading it in the same script as the event (`await new Promise(requestAnimationFrame)`).
  What the tests reach by name in the window (`act`, `state`, `tasks.current`, `window.__dock` …): `lib/test-hooks.ts`
  and the modules that set them.
- **Act as the human or the agent does**: the window's own controls (`ui(...)` clicks, `act(...)` as the renderer
  sends it, input events), the MCP tools (`call`). Reach into the core (`shell.task.createProfile`) only to set up
  what another test already covers, as `setup.ts` does.
- **Wait for a state, never for time.** `waitFor(() => condition)` (5 s by default); `sleep` only where nothing can
  be waited for (that something did *not* happen, a double click's gap), and short. A screen without a GPU is
  slower than the author's: a test that passes only on a fast one is a race.
- **Before a click, wait until the window is ready for it**: a project or task being shown
  (`!shell.windows[0].switching`, no `loading` class on the root), the panel there (`getPanel(...)?.`), the
  element drawn. A click while the window builds another grid is lost.
- **Menus and dialogs are Reka UI's**: `menuRows`, `choose`, `menuOpen`, `closeMenu`, `rightClick` (`helpers.ts`) read
  and drive the open menu (`.menu[data-state="open"]`, shown once it is `.ready`: the pages under it are pictures);
  a dialog is open when its `data-state` is `open`, and closed with its ×. How they behave under the hand (press, drag
  and let go; a right-click's release; the keyboard) is tested with input events (`sendInputEvent`): a key that types
  needs its `char` event too (Enter sends a form on it), and `insertText` is awaited before the next key; the window
  has the keyboard first (`focusWindow(shell.win, ui)`, which waits until its page has it: a key sent before goes
  to no page, or its focus lands after the key's), or focus events do not come. Tabs are chosen on the press:
  `click(ui, el)` makes a mouse's whole click. An input event's press on a tab leaves the keyboard on it (Reka's): blur
  it at the test's end, or a later dialog under Xvfb does not get it.
- **Names say what the human sees or gets**, as a sentence ("deleting a task asks first, saying what goes"); the
  comments say why it matters (the bug it once was).
- **Leave what later files need, say so** ("left closed for the restart phase"), and clean up the rest (a
  profile made for one test is deleted at its end: folder numbers are counted by later tests).
- **What it writes stays in its folder** (`root`, `userData`, `project` from `helpers.ts`); nothing in the user's
  data or home. A unit test makes its own temporary folder and removes it (`after`).
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
  `node --test`); what is loaded by a path is listed in `knip.jsonc` (the preload, the e2e groups `run.ts` requires
  by name), each with why. A finding about something used is fixed there, by its entry point; an `ignore` is the
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
  (layer 4), which may import anything. Below layer 1, the base (`worktrees.ts`, `local.ts`): used by every layer, using
  none of them. `src/shared/` is what the main process and the window both import (`names.ts`, `avatars.ts`,
  `result.ts`); it imports nothing else of `src/`. The window's page never imports `src/main`.
- A new file of a lower layer goes into its list. An import the rules refuse is moved, not allowed: what the lower
  file needs belongs below (the tab's target id went into `profiles.ts`), or the core says it on `shell.bus` and the
  handle listens (a profile unloaded: the MCP server clears its highlights).
- No cycles, but one: `src/renderer/lib/grid.ts` and `views.ts` call each other's functions only after both have
  loaded.

## Lint

`npm run lint` ([ESLint](https://eslint.org) with [typescript-eslint](https://typescript-eslint.io) and
[eslint-plugin-vue](https://eslint.vuejs.org), about 10 s: it reads the types) checks what `tsc` cannot see;
`npm test` runs it after knip. A few rules, chosen one at a time (`eslint.config.ts`), not the presets: those flag
every `any` from JSON and IPC and the templates' formatting, about 2400 places and no bug (measured 2026-10-13).

- **A promise is awaited, or `void` says it is not** (`no-floating-promises`): a forgotten `await` in a test makes a
  test that passes without checking. `void` is for what is meant to run on its own: an IPC message the window does
  not wait for, a dialog answered while the test goes on.
- `await` only on a promise (`await-thenable`); no `if (promise)` (`no-misused-promises`, not its void-return part:
  an async callback nobody waits for is fine, its rejection is logged in `app.ts`).
- A `switch` over a union names every case or has a `default` (`switch-exhaustiveness-check`).
- No `as` or `!` TypeScript does not need (`no-unnecessary-type-assertion`; `npx eslint . --fix` removes them). Not in
  the window: it took `{} as Record<…>` inside `reactive({ … })` for needless, the only type of a store's field.
- Vue's `essential` rules for the templates, without multi-word component names (Kulisa's are one word: `Modal`).

## Workflows

`npm test` checks the CI's workflows (`.github/workflows/`) with [actionlint](https://github.com/rhysd/actionlint)
after knip and ESLint, when it is installed; without it, it says so and goes on. GitHub refuses a whole workflow for one wrong
line, and says so only once it is pushed, with no job run (2026-10-12: `runner.temp` in a job's `env`). actionlint is
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
the session back with what failed. Not `npm run build` and the e2e groups: the language server shows type errors as
they are made, and the whole suite runs when the work is done (CLAUDE.md, Conventions).

## Running them

The full suite runs once, when the work is done, before the commit (CLAUDE.md); while building, the unit tests
and the group of the files changed, or a screenshot, and `npm run knip` once at the end of a step. A whole run stops by itself after 5 minutes (`run.ts`), a test
after 30 s, naming the call or script it began last (`ctx.step`): a step that hangs has no stack to read, and a
script run in a window that closes before its result is back never answers (Electron drops the reply), so a test
closes a window without waiting for the script that closes it (`closeSettings`).

**CI** (`.github/workflows/test.yml`): `npm test` on GitHub Actions at every pull request into `develop` or `main` and
every push to `develop` (CLAUDE.md, Releases; into `main` its `version` job checks the version raised; its
`dependencies` job, on pull requests, refuses a new dependency with a known vulnerability or a license not on its list:
`docs/LICENSING.md`), on Ubuntu (with Xvfb
and openbox, as on the author's machine), Windows and macOS (on the runner's own screen), git given a name (tasks
commit). A failed run keeps the groups' folders (their screenshots) as an artifact per OS for a week. Ubuntu and macOS
pass (macOS since 2026-10-16: "On macOS", above); Windows does not yet (ROADMAP, "macOS and Windows are untested"):
its runs report but do not fail the workflow (`continue-on-error`) until it passes once, fixed by a Claude session there.

On Linux the runner has no desktop: `npm test` runs in a D-Bus session with gnome-keyring made and unlocked, and
`XDG_CURRENT_DESKTOP=GNOME`, else `safeStorage` encrypts nothing and Kulisa keeps no session cookies nor test passwords
(the first run, 2026-10-12: five tests failed so). The keyring's key is made once before the groups start side by
side (`test/keyring.ts`, one Electron alone): Chromium looks it up and, finding none, stores a new one, so the two
groups starting at once on the runner's fresh keyring each made their own, the keyring kept the last, and the other
group's restart could not read the session cookies it had saved ("Signed out", one run in three; 2026-10-18). Its test folders are in the runner's temp, inside the home folder:
a test that reads a path as the window shows it shortens it to `~` as Kulisa does. Lines end in LF on every OS
(`.gitattributes`): git on Windows checked out CRLF, and a test comparing a file failed.

**The runner's failures, reproduced here.** GitHub's runner is slower (4 cores) and clean (no agents installed, no
desktop): tests that pass on the author's machine failed there now and then. Its conditions, locally, to fix them
without a push each time (the keyring's socket needs a short path, so the home folder is a short temporary one, removed
after; the script unlocks the keyring and runs `npm test`):

```sh
H=$(mktemp -d /tmp/kh.XXXX); printf '[user]\n\tname = t\n\temail = t@t\n' > $H/.gitconfig
printf '#!/bin/sh\necho ci | gnome-keyring-daemon --unlock --components=secrets >/dev/null\ncd %s && exec npm test\n' "$PWD" > $H/run.sh; chmod +x $H/run.sh
env -i PATH=$(dirname $(which node)):/usr/bin:/bin HOME=$H TMPDIR=$H XDG_CURRENT_DESKTOP=GNOME taskset -c 0-3 dbus-run-session -- $H/run.sh
```

Found so (2026-10-12): a click on the chosen row of Settings' tree un-chose it (Reka's Tree toggles: a bug of the
window, `selection-behavior="replace"` now); keys sent before the window's page had the keyboard (`focusWindow`); a
window's focus from the window manager coming after its page's, its blur closing the next test's menu; a script that
closes its own window never answering (a click deferred with `setTimeout`); a paste lost while that late focus took the
page's away (the clipboard is read only with it: pressed again until it lands). From the runner's logs (2026-10-13,
not reproduced here): a test ending with a back navigation in flight, the next one reading the address; a terminal
fitted at the whole window's height before its new window's grid was laid out; a group's close taking over 5 s under
two groups' load.

| File | What |
|---|---|
| `.github/workflows/test.yml` | the same on GitHub Actions at every pull request into `develop` or `main` and push to `develop`, on Linux, Windows and macOS |
| `test/start.ts` | `npm test`: the unit tests, knip, the window built, the groups in parallel, each on its own screen, then after a restart |
| `test/run.ts` | one app: starts Kulisa (`app.start`) with a fake agent (`cat`), runs the files it is given |
| `test/helpers.ts` | the group's folder, waiting, driving the window like the human |
| `test/setup.ts` | the fixture of a group that does not start with `agent.ts` |
| `test/fixtures/site.ts` | the local test site (sign-in by cookie, dialogs, a board shared by profiles, a site that never answers) |
