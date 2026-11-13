# browser-pane

Entry: `renderer/index.ts`. UI and local state only; shared runtimes and core task ownership remain outside.
Use other packages through their public entries. Receive facts/actions through the package host; never import
Task, Project, TaskGrid or task-view internals. Preserve Dockview IDs, process lifetimes and existing focus rules.
E2E: profiles, agent-panes, grid, stage, task-native.
