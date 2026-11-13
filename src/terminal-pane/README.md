# Terminal pane

Application-terminal Stage controls, search, selection and pending human launch focus.
[Task view](../task-view/README.md#pane-registration) supplies the host; [Terminal](../terminal/README.md) owns the
shared PTY/xterm runtime. Core owns configuration/process lifetime and cleanup ([Window](../../docs/window.md#stage-terminals)).

Human input, blur or `reset` cancels pending focus. Delayed focus rechecks task activity, coverage, dialogs and
pane visibility. Unmount disposes the visible View without stopping the process.

## The code

- `renderer/pane.tsx`, `state.tsx`: public factory, registration and launch focus.
- `renderer/StageTerminalPane.tsx`: application-terminal controls, search and header.
