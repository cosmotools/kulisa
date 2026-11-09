# Kulisa packages

A **Kulisa package** owns one capability in `src/<package>/`, exposes public entries and imports no core domain
code. Boundaries are checked by `.dependency-cruiser.ts`. Example: [terminal](../src/terminal/README.md).
UI clusters are different: [ui.md](ui.md), Clusters.

## What makes code one

- Use other Kulisa packages only through their entries, with no dependency cycles. Core infrastructure imports
  require an explicit allowance in `.dependency-cruiser.ts`.
- Receive core facts through parameters or package-owned interfaces implemented by callers. Tasks, agents,
  profiles and window state stay outside.
- Extend a dependency's API in its own terms when broadly useful. Avoid caller-specific flags and duplicate
  implementations; ask the author if the boundary is unclear.
- **The caller states facts; the package does the work.** Keep lifecycle, timers, views, placement and files behind
  its API. Supply shared menus and core actions as callbacks rather than copying them into handles.
- For example, the screenshots caller supplies pane bounds, covered-page and task-close events, menu opening and
  Send to Agent. The package owns the thumbnail. Task/agent terminal controls remain outside `src/terminal/`.
- When presenting an extraction, account for every touched file outside the boundary and why it belongs there.

## How one is laid out

```text
src/<package>/
  AGENTS.md              entries, allowed dependencies, ownership, tests
  CLAUDE.md              @AGENTS.md
  README.md              behavior, rationale, channels; ends with "The code"
  ipc.ts                 channel contracts, joined by src/shared/ipc.ts
  main/index.ts          main entry
  main/                  implementation
  renderer/index.ts      renderer entry
  renderer/              implementation
  renderer/tsconfig.json extends the window's configuration
  *.test.ts              plain-Node unit tests
```

Omit absent halves. A package-owned page's script belongs in `renderer/`; its HTML loader stays under
`src/renderer/`, Vite's root. E2e tests stay in `test/e2e/`, named in the README.

Package channels are declared in its `ipc.ts` and handled internally through the shared `handle`/`on` functions.
Task/window channels that call a package remain in `src/shared/ipc.ts` and core handles.
Main-process imports name `index.ts` explicitly: Node ESM does not resolve directory imports. Vite resolves renderer
entries by directory.

## Its rules, and what checks them

- Outside access: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Halves share types only. Neither imports core
  domain types; the renderer imports no window/main code. `npm run deps` enforces this through the `packages` table.
- Main code and allowed infrastructure must load in plain Node tests: obtain Electron objects from its default
  import, not named imports ([testing.md](testing.md)).
- Root `tsconfig.json` includes `src/*/main`, `src/*/ipc.ts`, `src/*/*.test.ts`; the renderer config includes
  `src/*/renderer`. Unit runners share the package test glob.
- Forge ships `main/` and `ipc.ts`; Vite bundles `renderer/` into `dist/renderer`; package docs/tests stay out.
- Add a package's dependency-cruiser entry. Fix checks that silently skip it generically, not with one-off globs.

## Its docs

- README: capability, callers, ownership, implementation reasons, channels and "The code" grouped by responsibility.
  Move detailed implementation prose here; other developer docs keep a link and necessary integration facts.
- AGENTS: entries, dependencies, ownership and tests. CLAUDE: `@AGENTS.md` only.
- Keep cross-cutting catalogs in their owning docs: action tables, keys, environment variables and manual-check
  issues (#193, #194, #205). The user guide remains self-contained and uses no developer-doc links.

## Moving code into one, step by step

1. Read dependencies and explain the boundary before moving; domain-aware code stays outside.
2. Use `git mv`, repair imports and pass dependencies through the API. Preserve behavior.
3. Move package channels into `ipc.ts`; extend their interfaces from `src/shared/ipc.ts`.
4. Add the dependency-cruiser entry. Verify forbidden imports fail using a scratch file, then remove it.
5. Move docs, leave links, add agent instructions, update code maps and search code/comments/docs for old paths.
6. Review touched outside files: package-owned checks, timers, state and channels belong inside.
7. Run `npm run package`; inspect with `npx asar list out/*/resources/app.asar` for shipped main/contracts and
   excluded renderer sources/tests/docs. Remove `out/` afterward.

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
| `src/editor/` | editable text files, recovery drafts and version-checked autosave ([README](../src/editor/README.md)) | `files.ts` (atomic writes) |
| `src/file-viewer/` | extensible read-only text/PDF/image display for Artifacts ([README](../src/file-viewer/README.md)) | nothing |
| `src/project-explorer/` | directory reads and a folder tree; roots, file actions and menus supplied by the caller ([README](../src/project-explorer/README.md)) | nothing |
| `src/task-files/` | ordinary files, confined actions, live results and a tree with bounded previews ([README](../src/task-files/README.md)) | `remove.ts` |
| `src/activity-monitor/` | what Kulisa takes on the computer: the tasks' artifacts on the disk, every task's or some ([README](../src/activity-monitor/README.md)) | nothing |
| `src/ui/` | shadcn/ui's components as its CLI writes them, and their theme: the window's alone, through `index.ts` ([README](../src/ui/README.md)) | (no main half) |
