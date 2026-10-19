# Kulisa packages

A **Kulisa package** is a part of Kulisa that knows nothing of the rest, with all of it in one folder `src/<package>/`,
reached from outside only through its entries. The term is the author's (2026-10-18), after "Kulisa plugin": an npm
package's idea (one folder, its own doc, a public API and nothing else seen) in Kulisa's own context. Always the two
words: a bare "package" is an npm package (a dependency) or the app's package (Forge's build, the installers). Not an
extension (what the user may turn off; a Kulisa package is built in), nor a cluster (a folder of the window's
components, [ui.md](ui.md), Clusters). The first is the terminal, `src/terminal/` (its
[README](../src/terminal/README.md)): the example this doc points to.

Why (the author, 2026-10-18): code smeared over `src/` is hard to keep in hand. In one folder a part is read, changed
and reviewed in one place; its boundary is checked, not remembered; and Claude Code, working in it, reads its own
`CLAUDE.md` by itself. Kulisa moves to it gradually: a part at a time, when it is worked on and found self-contained;
no big move.

## What makes code one

**The direction of its dependencies.** A Kulisa package is used by the rest and uses none of it, but the little
infrastructure its line in `.dependency-cruiser.ts` names (the terminal's main half: the main process's `ipc.ts`, for
its channels, and `log.ts`). It knows nothing of tasks, agents, profiles or the window's state; they use it. What it
needs from them comes in through its API, passed by the caller (the terminal's screen size: `screen` in
`startTerminal`, the MCP server's `READ_MAX` passed by `tasks.ts`).

Code that is *about* the thing but knows the rest stays outside, using the package: for the terminal, the island
(`Terminals.vue`, `TerminalTabs.vue`, `lib/terminals.ts`: its agents' buttons, the closed profiles' tiles, Change
agent…, the project's accounts in its +), the agents in terminals (`tasks.ts`: conversations, handing over, the
agent's state, dictation) and the agent's tools (`terminal_run`, `terminal_read`, `terminal_stop` in `mcp-server.ts`:
what the agent sees lives in the Kulisa plugin, CLAUDE.md, Architecture). Drawn so, the island would have pulled half
of `src/renderer/lib` into the folder, and the boundary would have meant nothing.

## How one is laid out

```
src/<package>/
  CLAUDE.md          working in it: its entries, its rules, what stays outside, where its tests are
  README.md          how it works and why, as docs/ does for the rest; its last section "The code"
  ipc.ts             its channels' types (<Name>Send, <Name>Events, …), joined in src/shared/ipc.ts
  main/index.ts      the main process's half: its entry
  main/…             its other files
  renderer/index.ts  the window's half: its entry
  renderer/…         its other files (.ts; .vue when it has parts of the window of its own)
  renderer/tsconfig.json   extends src/renderer's; ESLint finds the half's types by it
  *.test.ts          its unit tests, plain Node (docs/testing.md)
```

A half it does not have is left out. Its e2e tests stay in `test/`, in the group whose state they need (a group is one
app: [testing.md](testing.md)); its README names which files.

## Its rules, and what checks them

- From outside only through `main/index.ts`, `renderer/index.ts` and `ipc.ts`; the window takes its `renderer/`, the
  main process its `main/`; its two halves share only types (they run in two processes); its `main/` uses of
  `src/main` only what its line allows; its `renderer/` nothing of the window or the main process. `npm run deps`
  (`packages` in `.dependency-cruiser.ts`: a new package is a line there, what its main half may use).
- `tsc` and `vue-tsc` check both halves: `tsconfig.json` takes every `src/*/main`, `src/*/ipc.ts` and
  `src/*/*.test.ts`, `src/renderer/tsconfig.json` every `src/*/renderer` (the window's build imports it anyway).
- `npm run test:unit` and `npm test` run `src/*/*.test.ts` (`package.json`, `test/start.ts`: the same two globs).
- The app's package (`forge.config.ts`, `ignore`) keeps a package's `main/` and `ipc.ts`, which the main process runs
  from source, and leaves out its `renderer/` (Vite builds it into `dist/renderer`), its tests and its docs.

These are written for any `src/<package>/`: a new one needs only its line in `.dependency-cruiser.ts`. When one of
them does not take it (a check that silently skips it is the danger), fix the config for every package, not for one.

## Its docs

- `README.md`: what it is and who uses it (and that it knows nothing of them), how each half works and why, its
  channels, "The code" (its files, its e2e test files), as the docs in `docs/` are written (CLAUDE.md, Conventions).
  The paragraphs of `docs/` about it move there; `docs/` keeps a sentence and a link where the topic was.
- `CLAUDE.md`, short: that it is a Kulisa package (and this doc), its entries and what its halves may use, what stays
  outside and so where a rule about that belongs, where its tests are. Claude Code reads a folder's `CLAUDE.md` when
  it reads the folder's files; other agents read the root one, which points here.

## Moving code into one, step by step

The terminal's move (2026-10-18) is the example; each step says what it found.

1. **Draw the line by dependencies**, reading the code: what imports tasks, agents, profiles or the window's store
   stays outside. Say the line to the author before moving: the island was in the first sketch and came out on reading.
2. **Move without changing behavior**: `git mv` (so git keeps the history), the imports fixed; what the package took
   from outside becomes a parameter of its API. Not a rewrite: the e2e tests passing unchanged is the proof.
3. **Its channels** into `ipc.ts`, `src/shared/ipc.ts` extending its interfaces.
4. **Its line in `.dependency-cruiser.ts`**, then check each rule fires: put a forbidden import in a scratch file,
   see `npm run deps` refuse it, remove it.
5. **Its docs**: `README.md` from the paragraphs of `docs/`, a link left there; `CLAUDE.md`; "The code" tables of the
   other docs; the old paths searched for in `docs/`, `CLAUDE.md`, `README.md` and the code's comments.
6. **Its unit tests** into the folder; then the full `npm test`, and the number of unit tests the same as before (the
   terminal's was not run by `npm test` at first: `test/start.ts` had a glob of its own).
7. **The app's package**: `npm run package`, then its archive listed (`npx asar list out/*/resources/app.asar`): its
   `main/` and `ipc.ts` in, its `renderer/`, tests and docs out (the terminal's docs went in at first); `out/`
   removed after.

## The Kulisa packages

| Folder | What | Its main half uses |
|---|---|---|
| `src/terminal/` | a terminal: its pty in the user's shell, its buffers and the xterm a place shows ([README](../src/terminal/README.md)) | `ipc.ts`, `log.ts` |
