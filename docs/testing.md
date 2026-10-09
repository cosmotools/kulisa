# Testing

How Kulisa's tests are built and how to write one. **Read this before writing a test.** Every behavior change comes
with a test (CLAUDE.md); a bug is first reproduced by a failing test, then fixed.

## Two layers

| Layer | Where | Runs in | For |
|---|---|---|---|
| Unit | `test/unit/*.test.js` (`node:test`) | plain Node, about a second: `npm run test:unit` | logic that needs no window: names, the data folder, a workspace's profiles in order, the agents' files |
| End to end | `test/*.js` (`run.js`) | the real app, against the local test site (`fixtures/site.js`) | everything the human or the agent does: the window, profiles' pages, MCP tools, restarts |

A check goes into the cheapest layer that can show the behavior: a rule about names is a unit test; that the name
field leaves characters out as they are typed is end to end. A module a unit test needs must load in plain Node (no
`node-pty`, no Electron objects used at load); when it cannot, the check stays end to end.

## End to end: groups

`npm test` runs the unit tests, then the groups of e2e files in parallel (`GROUPS` in `start.js`):

- **A group is one app, its files in order**: later files build on what earlier ones left (profiles, sign-ins,
  projects), as the human's day does. Then the app is restarted in the same folder and the group's restart file
  checks what must survive (`restart-<group>.js`).
- **Groups are independent**: each has its own folder (`$KULISA_TEST_ROOT`, `/tmp/kulisa-test/<group>`), its own
  MCP port, on Linux its own screen; only the test site is shared. A group that does not start from nothing starts
  from a fixture file (`setup.js`: the profiles and the agent's session the first group makes on its way).
- **A new file** goes into the group whose state it needs; a new group when a file would make a group much longer
  than the others (the run takes as long as the longest group: today about a minute). Give it a `setup` fixture
  rather than a dependency on another group.
- One group: `npm test -- workspaces`. Its folder is removed when it passes, kept to look at when it fails.

**On Linux the tests run on a screen of their own** (Xvfb, with the openbox window manager: without one windows are
not listed for screenshots and focus differs from a desktop), so they never take the human's focus or clipboard.
`npm run test:visible` runs them on the human's screen, one group after another. No GPU there:
`--ignore-gpu-blocklist` lets WebGL run on Chromium's software renderer. macOS and Windows run them on the screen.

## Writing an e2e test

- **Act as the human or the agent does**: the window's own controls (`ui(...)` clicks, `act(...)` as the renderer
  sends it, input events), the MCP tools (`call`). Reach into the core (`shell.ws.createProfile`) only to set up
  what another test already covers, as `setup.js` does.
- **Wait for a state, never for time.** `waitFor(() => condition)` (5 s by default); `sleep` only where nothing can
  be waited for (that something did *not* happen, a double click's gap), and short. A screen without a GPU is
  slower than the author's: a test that passes only on a fast one is a race.
- **Before a click, wait until the window is ready for it**: a project or workspace being shown
  (`!shell.windows[0].switching`, no `loading` class on the root), the panel there (`getPanel(...)?.`), the
  element drawn. A click while the window builds another grid is lost.
- **Names say what the human sees or gets**, as a sentence ("closing a fork asks first, saying what goes"); the
  comments say why it matters (the bug it once was).
- **Leave what later files need, say so** ("left closed for the restart phase"), and clean up the rest (a
  profile made for one test is deleted at its end: folder numbers are counted by later tests).
- **The microphone is Chromium's fake one** (`run.js`), playing `fixtures/hey-kulisa.wav` (synthetic speech) in a
  loop, for voice commands; their model is downloaded once into `/tmp/kulisa-test/voice-model` and kept there for
  the next runs, the one thing the tests keep.
- **What it writes stays in its folder** (`root`, `userData`, `project` from `helpers.js`); nothing in the user's
  data or home. A unit test makes its own temporary folder and removes it (`after`).
- **Budget**: a test that takes over 2 s says why in a comment (git's work, a wait by design). Each action of the
  agent (a click, typing, a key) waits 0.5 s while it is shown in the page (`ghost.js`, Playwright's
  `showActions`): a test of the agent's tools takes about that per action.

## Running them

The full suite runs once, when the work is done, before the commit (CLAUDE.md); while building, the unit tests
and the group of the files changed, or a screenshot. A whole run stops by itself after 5 minutes (`run.js`), a test
after 30 s.

| File | What |
|---|---|
| `test/start.js` | `npm test`: the unit tests, the groups in parallel, each on its own screen, then after a restart |
| `test/run.js` | one app: starts Kulisa (`app.start`) with a fake agent (`cat`), runs the files it is given |
| `test/helpers.js` | the group's folder, waiting, driving the window like the human |
| `test/setup.js` | the fixture of a group that does not start with `agent.js` |
| `test/fixtures/site.js` | the local test site (sign-in by cookie, dialogs, a board shared by profiles, a site that never answers) |
