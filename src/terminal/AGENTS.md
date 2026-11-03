# Terminal

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Allowed core imports: `ipc.ts`, `log.ts`;
  the renderer imports no window code.
- Tasks, agents and profiles belong to callers (`tasks.ts`, `DevelopmentTerminals.tsx`). Agent rules stay there.
- Unit tests: `*.test.ts`; integration tests: README, The code.
