# Terminal pane

Application-terminal Stage UI: run/stop/settings, search, selection, pane/header, launchers and human launch focus.
Coding-agent terminals stay in Workbench. Both use the existing `terminal` PTY/xterm runtime; this package creates
one View per mounted Stage terminal, as before.

`renderer/index.ts` exposes `createTerminalPane(host)` and `TerminalPaneHost`. Create one controller per immutable
task page. The host supplies task-scoped actions, read-only terminal/activity facts, the common maximize control
and agent availability for Send selection. The returned definition implements
[Stage's registration contract](../task-view/README.md#pane-registration). No Task, Project or TaskGrid is imported.

The package owns search state and pending human launch focus. Another human input, blur or host `reset` cancels
pending focus; delayed selection still checks task activity, coverage, dialogs and pane visibility. Page-scoped input
listeners bind once and expire with that page. Unmount disposes the visible View without stopping the process.
Core `StageTerminals` owns configuration/process lifetime and close/teardown; see
[Window](../../docs/window.md#stage-terminals). Renderer-loss protocol lifetime remains #399.

## The code

- `renderer/pane.tsx`: public factory, Stage definition and launchers.
- `renderer/StageTerminalPane.tsx`: application-terminal controls, search and header.
- `renderer/state.tsx`: read-only host boundary and cancellable launch focus.
