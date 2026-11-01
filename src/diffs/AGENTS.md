# Diffs

A Kulisa package: `docs/packages.md`; behavior and integration: `README.md`.

- Outside callers use `main/index.ts`, `renderer/index.ts` and `ipc.ts` only.
- The main half reads a supplied resource folder through the shared Git client in `src/main/worktrees.ts`.
  Keep resource ownership checks and task starting commits in `Task`.
- The renderer takes resource access, selection and menu callbacks through `DiffsActions`; the caller supplies
  theme shade and text size. It imports no window state, Dockview or task IPC.
- Keep one bounded review snapshot and one CodeView scroll document. Read the installed official `diffs` skill
  before changing Pierre rendering; installed dependency types decide the available API.
- Unit tests live in `diffs.test.ts`; end-to-end tests stay in `test/e2e/diffs.spec.ts` and Resources' files.
