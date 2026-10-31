# Project Explorer

A Kulisa package: `docs/packages.md`; behavior and integration: `README.md`.

- Outside callers use `main/index.ts`, `renderer/index.ts` and `ipc.ts` only.
- Neither half imports core domain code. The main half takes folder roots; the renderer takes file-access and menu callbacks through `ExplorerActions`. Other Kulisa packages are reached through their entries.
- Tasks, repository ownership and removal, root labels and grouping, Resources tabs and artifacts stay in the core/window. Task-specific IPC handles supply roots and call this Kulisa package.
- Keep the shadcn File Tree composition: Collapsible folders and Button files; never edit `src/ui`.
- Unit tests: `files.test.ts`. End-to-end tests: `test/e2e/resources.spec.ts`, `project-repositories.spec.ts`; the full suite also covers Resources layouts and artifacts.
