# Agent management

Read `README.md` and `docs/packages.md`. Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`.

- Core imports: `ipc`, `log`, `store` (IDs), `files`, `remove` only; no core domain types or window components.
- CLI-specific behavior stays in Kulisa plugin adapters. Use other packages through public entries.
- Preserve external files/login and owned-folder cleanup on cancellation/failure, including discovery/startup races.
- Tests: `accounts.test.ts`, `management.test.ts`; window/adapter coverage: README, The code.
