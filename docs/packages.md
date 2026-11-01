# Kulisa packages

A **Kulisa package** is a part of Kulisa that does one thing and knows nothing of the core (other Kulisa packages only
by their entries), all of it in one folder `src/<package>/`, reached from outside only through its entries (the term:
AGENTS.md, Conventions; not a cluster, [ui.md](ui.md), Clusters). The example this doc points to is the terminal,
`src/terminal/` (its [README](../src/terminal/README.md)).

Why: in one folder a part is read, changed and reviewed in one place, its boundary is checked rather than remembered,
and each folder keeps its own agent instructions in `AGENTS.md`. Code moves into one a part at a time, when it is
worked on and found self-contained; no big move.

## What makes code one

**The direction of its dependencies.** A Kulisa package is an abstraction that does one thing. It uses the open API
of other Kulisa packages (their entries, never their other files), and of the rest of Kulisa only the little
infrastructure its line in `.dependency-cruiser.ts` names (the terminal's main half: the main process's `ipc.ts`, for
its channels, and `log.ts`); the packages it uses do not use it back, so no cycle forms. Of what is not a package
(tasks, agents, profiles, the window's state: the core) it imports nothing; they use it. What it needs from them comes
in through its API, passed by the caller (the terminal's retained screen lines: `screen` passed to `startTerminal`
by `tasks.ts`), or as a small interface the package declares and the caller implements; once that
part is a package of its own, the package uses its API instead.

**A package it uses lacks something:** that package's API is extended, when the extension is a general one, of use to
any caller, in that package's own terms; not a crutch shaped for this one caller (a flag, an entry named after it), nor
the same thing worked out again beside it. Where it is not clear which of the two an extension is, the author decides
before it is built.

Code that is *about* the thing but knows the rest stays outside, using the package: for the terminal, the terminals'
panel (`components/grid/DevelopmentTerminals.tsx`, `lib/development-terminals.ts`: its agents' buttons, the closed profiles' tiles, Change
agent…, the project's accounts in its +), the agents in terminals (`tasks.ts`: conversations, handing over, the
agent's state) and the agent's tools (`shell_run`, `shell_read`, `shell_stop` in
`kulisa-plugin/main/tools/shell.ts`: what the agent sees lives in the Kulisa plugin, AGENTS.md, Architecture). Inside,
the terminals' panel would pull half of `src/renderer/lib` with it, and the boundary would mean nothing.

**The caller stays thin: it states facts, the package does the work.** What the package's things are and do (their
life, their timers, their views, their places, their files) is the package's, behind a small API; the code outside
gives it what only the rest knows and calls it. The screenshots' thumbnail: the window makes it (`new Thumbnails(win,
…)`) and says where its panes are after a change of the grid (`place`), that its pages are covered (`setHidden`), that
a task goes (`close`). What only the rest can do comes in as a function:
- the window's own components (its menus, dialogs: one set of components, `docs/ui.md`): the window passes the opener
  (`thumbnailMenu(menuAtPoint)`), the package gives the rows and what they do;
- what belongs to tasks or agents (Send to Agent: `send`, the window's `Task.typeForAgent`).

An action outside that a package needs and another part does already (typing for the agent: Pick does) is written
once, outside, and passed in: not copied into a handle. Before a package's step is shown, every file outside it that
it touched is listed with why that line cannot be in the package (the screenshots' README, The code).

## How one is laid out

```
src/<package>/
  CLAUDE.md          imports the adjacent AGENTS.md for Claude Code (`@AGENTS.md`)
  AGENTS.md          working in it: its entries, its rules, what stays outside, where its tests are
  README.md          how it works and why, as docs/ does for the rest; its last section "The code"
  ipc.ts             its channels' types (<Name>Send, <Name>Events, …), joined in src/shared/ipc.ts
  main/index.ts      the main process's half: its entry
  main/…             its other files
  renderer/index.ts  the window's half: its entry
  renderer/…         its other files (.ts; .tsx for parts of the window of its own; a page of its own, as the
                     screenshots' thumbnail: its script here, its .html a shell in src/renderer that only loads
                     it, as Vite builds no page outside its root)
  renderer/tsconfig.json   extends src/renderer's; ESLint finds the half's types by it
  *.test.ts          its unit tests, plain Node (docs/testing.md)
```

**Its channels are all in its `ipc.ts`**, those of its own pages and those between the window's page and the main
process about its things, and handled inside it (its main half through `ipc.ts`'s `handle`, `on`); nothing outside
listens to a package's channel. A channel of a pane or a task that only calls the package (the human's
`tab:screenshot`: find the tab, call the core) is the window's, in `src/shared/ipc.ts`.

**Imports** name the entry's file in the main process (`'../screenshots/main/index.ts'`): it runs from source, and
Node's ES modules resolve no folder to its `index` (`ERR_UNSUPPORTED_DIR_IMPORT`). The window's side goes through Vite,
which does (`'../../terminal/renderer'`).

A half it does not have is left out. Its e2e tests stay in `test/e2e/` with the others ([testing.md](testing.md)); its README names which files.

## Its rules, and what checks them

- From outside only through `main/index.ts`, `renderer/index.ts` and `ipc.ts`; the window takes its `renderer/`, the
  main process its `main/`; its two halves share only types (they run in two processes); its `main/` uses of
  `src/main` only what its line allows, nothing of the window; `ipc.ts` imports no core domain types; its `renderer/` nothing of the window or the main process. `npm run deps`
  (`packages` in `.dependency-cruiser.ts`: a new package is a line there, what its main half may use).
- A unit test may load its main half (`profiles.ts` imports the screenshots' `Profile.screenshot`'s capture; the unit
  tests load `profiles.ts`): its files and what they import from `src/main` (`ipc.ts`, `log.ts`) take Electron's
  objects from the module, not by name (docs/testing.md). `npm run test:unit` fails at load otherwise.
- `tsc` checks both halves: `tsconfig.json` takes every `src/*/main`, `src/*/ipc.ts` and
  `src/*/*.test.ts`, `src/renderer/tsconfig.json` every `src/*/renderer` (the window's build imports it anyway).
- `npm run test:unit` and `npm test` run `src/*/*.test.ts` (`package.json`, `test/start.ts`: the same two globs).
- The app's package (`forge.config.ts`, `ignore`) keeps a package's `main/` and `ipc.ts`, which the main process runs
  from source, and leaves out its `renderer/` (Vite builds it into `dist/renderer`), its tests and its docs.

These are written for any `src/<package>/`: a new one needs only its line in `.dependency-cruiser.ts`. A check that
silently skips one is fixed in the config for every package, not for that one.

## Its docs

- `README.md`: what it is and who uses it (and that it knows nothing of them), how each half works and why, its
  channels, "The code" (its files, its e2e test files), as the docs in `docs/` are written (AGENTS.md, Conventions).
  The paragraphs of `docs/` about it move there; `docs/` keeps a sentence and a link where the topic was.
- **Outside the package, only what a reader outside needs, never a retelling**: the guide (`docs/guide.md`: for the
  user, and it may not link to other docs), the lists that hold all of a kind with a word and a link each (the table
  of actions in `profiles.md`, the keys in `window.md`, the environment variables in the README, "The code" tables,
  the manual checks' issues, #193, #194, #205), and a sentence where a doc's topic leads into the package. How it works and why is
  only in its README.
- `AGENTS.md`, short: that it is a Kulisa package (and this doc), its entries and what its halves may use, what stays
  outside and so where a rule about that belongs, where its tests are. `CLAUDE.md` contains only `@AGENTS.md`,
  so both agents use the same rules.

## Moving code into one, step by step

1. **Draw the line by dependencies**, reading the code: what imports tasks, agents, profiles or the window's store
   stays outside. Say the line to the author before moving.
2. **Move without changing behavior**: `git mv` (so git keeps the history), the imports fixed; what the package took
   from outside becomes a parameter of its API. Not a rewrite: the e2e tests passing unchanged is the proof.
3. **Its channels** into `ipc.ts`, `src/shared/ipc.ts` extending its interfaces.
4. **Its line in `.dependency-cruiser.ts`**, then check each rule fires: put a forbidden import in a scratch file,
   see `npm run deps` refuse it, remove it.
5. **Its docs**: `README.md` from the paragraphs of `docs/`, a link left there; `AGENTS.md` and its `CLAUDE.md` import;
   "The code" tables of the other docs; the old paths searched for in `docs/`, `AGENTS.md`, `README.md` and the code's comments.
6. **Its unit tests** into the folder; then the full `npm test`, and the number of unit tests the same as before (a glob
   of its own in `test/start.ts` would miss them).
7. **What is left outside**: each file outside the package that it touches, and why that line is not in it (the
   caller states facts, above); a check, a timer, a state or a channel outside is moved in.
8. **The app's package**: `npm run package`, then its archive listed (`npx asar list out/*/resources/app.asar`): its
   `main/` and `ipc.ts` in, its `renderer/`, tests and docs out; `out/` removed after.

## The Kulisa packages

| Folder | What | Its main half uses |
|---|---|---|
| `src/kulisa-plugin/` | agent integration: tools, hooks, shared skills, CLI adapters and transcript readers ([README](../src/kulisa-plugin/README.md)) | `log.ts`, `store.ts`, `files.ts` (atomic writes), `remove.ts` |
| `src/browser/` | browser sessions, tabs, navigation, cookies, storage and native views ([README](../src/browser/README.md)) | `log.ts`, `files.ts`, `local.ts` |
| `src/terminal/` | a terminal: its pty in the user's shell, its buffers and the xterm a place shows ([README](../src/terminal/README.md)) | `ipc.ts`, `log.ts` |
| `src/screenshots/` | a picture of a page (an element, the visible part, the whole page), kept as the human's, its thumbnail ([README](../src/screenshots/README.md)) | `ipc.ts`, `log.ts` |
| `src/dictation/` | speaking to the agent: what each task's microphone shows, and recording ([README](../src/dictation/README.md)) | `ipc.ts`, `log.ts` |
| `src/github/` | the GitHub accounts: Kulisa App's device flow or a fine-grained token, their tokens kept with the keyring, a repository's account ([README](../src/github/README.md)) | `ipc.ts`, `log.ts`, `store.ts` (`newId`), `files.ts` (atomic writes) |
| `src/diff/` | local Git comparison and virtualized file review ([README](../src/diff/README.md)) | `worktrees.ts` (shared Git client) |
| `src/explorer/` | directory reads and a folder tree; roots, file actions and menus supplied by the caller ([README](../src/explorer/README.md)) | nothing |
| `src/activity-monitor/` | what Kulisa takes on the computer: the tasks' artifacts on the disk, every task's or some ([README](../src/activity-monitor/README.md)) | nothing |
| `src/ui/` | shadcn/ui's components as its CLI writes them, and their theme: the window's alone, through `index.ts` ([README](../src/ui/README.md)) | (no main half) |
