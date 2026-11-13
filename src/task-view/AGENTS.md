# task-view

Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Main uses IPC/log infrastructure and public Browser entries;
`shared/` stays pure. Built-in pane adapters register in `renderer/stage-panes.tsx`; preserve persisted panel/component
identities and keep process cleanup in core, independent of pane visibility/disposal. Unit: `test/unit/stage-layout.test.ts`;
E2E: task-view/task-native/task-failure/grid/stage/editor/resources.
