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

`npm test` runs the unit tests, knip (Dead code, below), builds the window (`npm run build`: its types checked, then Vite), then the groups of
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
`npm run test:visible` runs them on the human's screen, one group after another. No GPU there:
`--ignore-gpu-blocklist` lets WebGL run on Chromium's software renderer. macOS and Windows run them on the screen.

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
  has the keyboard first (`shell.win.focus()`), or focus events do not come. Tabs are chosen on the press:
  `click(ui, el)` makes a mouse's whole click.
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

## Running them

The full suite runs once, when the work is done, before the commit (CLAUDE.md); while building, the unit tests
and the group of the files changed, or a screenshot, and `npm run knip` once at the end of a step. A whole run stops by itself after 5 minutes (`run.ts`), a test
after 30 s.

**CI** (`.github/workflows/test.yml`): `npm test` on GitHub Actions at every push to `main`, on Ubuntu (with Xvfb
and openbox, as on the author's machine), Windows and macOS (on the runner's own screen), git given a name (tasks
commit). A failed run keeps the groups' folders (their screenshots) as an artifact per OS for a week. macOS and
Windows do not pass yet (ROADMAP, "macOS and Windows are untested"): their runs report but do not fail the workflow
(`continue-on-error`), until each passes once; each is fixed by a Claude session on that OS.

| File | What |
|---|---|
| `.github/workflows/test.yml` | the same on GitHub Actions at every push to `main`, on Linux, Windows and macOS |
| `test/start.ts` | `npm test`: the unit tests, knip, the window built, the groups in parallel, each on its own screen, then after a restart |
| `test/run.ts` | one app: starts Kulisa (`app.start`) with a fake agent (`cat`), runs the files it is given |
| `test/helpers.ts` | the group's folder, waiting, driving the window like the human |
| `test/setup.ts` | the fixture of a group that does not start with `agent.ts` |
| `test/fixtures/site.ts` | the local test site (sign-in by cookie, dialogs, a board shared by profiles, a site that never answers) |
