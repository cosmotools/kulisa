# Project Explorer

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`; no core domain imports. Main receives roots; renderer
  receives `ExplorerActions`. Other Kulisa packages are reached through entries.
- Core/window own tasks, repository ownership/removal, labels/grouping, Resources and artifacts. Task IPC supplies roots.
- Preserve shadcn File Tree composition; never hand-edit generated `src/ui` files.
- Material Icon Theme owns file artwork/associations; Lucide owns folder icons. Generate assets in Vite, not renderer;
  keep matching independent of editors.
- Unit tests: `files.test.ts`, `icons.test.ts`; e2e: `resources.spec.ts`, `project-repositories.spec.ts` and Resources layouts.
