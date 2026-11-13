# Browser pane

Browser-profile Stage UI, including tab-bound address drafts, dialogs, Pick and caption state, keyboard handles
and page geometry. [Browser](../browser/README.md) owns sessions/native views; core owns profiles and cleanup.
[Task view](../task-view/README.md#pane-registration) supplies the host and owns native snapshot handoff, also used by PDF.

`reset` clears transient state/timers; `dismiss` cancels address drafts. Unmount removes handles/observers without
closing profiles. The header notch needs concave masks; narrow panes move Back, Forward and Reload into the menu
in that order, keeping Pick and the menu reachable.

## The code

- `renderer/pane.tsx`, `state.tsx`: public factory, registration and local state/lifetime.
- `renderer/ProfilePane.tsx`, `ProfilePane.css`, `pages.ts`: pane/header, drafts/dialogs and native geometry.
- `renderer/launchers.ts`: closed-profile opening actions.
