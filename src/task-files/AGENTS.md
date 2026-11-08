# Task Files

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Import no core domain types or window state.
- Main uses only `remove.ts` from core infrastructure. Callers supply paths, lifecycle and logging; other Kulisa
  packages are reached through public entries. Electron is obtained through its default import for plain Node tests.
- Keep filesystem checks, watchers, timers, scan coordination and preview memory inside this package. The caller
  owns tasks, conversation identity, retention, agent instructions, IPC/MCP routing and desktop actions.
- Preserve ordinary filenames, empty/nested folders, exclusive generated writes and link exclusion. Disposal must
  release watchers, timers and previews; no disk quota or automatic expiry.
- Use public Trees APIs and caller-provided menu/action callbacks. Keep basename thumbnail collisions generic
  until #400; never patch upstream internals or generated `src/ui` components.
- Unit coverage: `files.test.ts`; E2e: `task-files.spec.ts`, `agent-reports.spec.ts`, `profiles.spec.ts`.
