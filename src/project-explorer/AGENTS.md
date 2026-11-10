# Project Explorer

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`; no core domain imports. Main receives roots and a Git runner; renderer
  receives `ExplorerActions`. Other Kulisa packages are reached through entries.
- Core/window own tasks, repository ownership/removal, labels/grouping, Workbench bars and artifacts. Task IPC supplies roots.
- Use public `@pierre/trees` APIs for one virtualized tree across roots; never hand-edit generated `src/ui` files.
- Use Trees' complete built-in icons, matching and colors, including its filename-specific icons (the author's choice).
  Feed working-tree/index statuses through native `setGitStatus`; use row decorations for non-Git metadata.
  Keep shallow loading and foreground polling inside this package; #389 tracks removal of Trees compatibility code.
- Unit tests: `files.test.ts`, `directories.test.ts`; e2e: `resources.spec.ts`, `project-repositories.spec.ts` and Workbench layouts.
