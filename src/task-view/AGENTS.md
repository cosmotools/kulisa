# task-view

[Package rules](../../docs/packages.md); ownership and lifecycle: [README](README.md).
Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`. Main uses IPC/log infrastructure and public Browser entries;
`shared/` stays pure. Unit: `test/unit/stage-layout.test.ts`;
E2E: task-view/task-native/task-failure/grid/stage/editor/resources.
Follow [test rules](../../docs/testing.md#writing-an-e2e-test).
