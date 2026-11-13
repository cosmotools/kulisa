# Browser pane

The browser profile's Stage UI: tabs, address drafts, navigation, dialogs, Pick, screenshots, header, launchers and
native-page geometry. Browser sessions and native views remain in `browser`; core owns profiles, permissions and cleanup.

`renderer/index.ts` exposes `createBrowserPane(host)` and `BrowserPaneHost`. Create one controller per immutable task
page. The host supplies task-scoped actions, read-only profile/activity/snapshot facts and the common maximize control.
The returned `definition` implements [Stage's registration contract](../task-view/README.md#pane-registration);
`pane(profile)` exposes mounted keyboard handles and `screenshot` serves the keyboard's screenshot action.
No Task, Project or TaskGrid is imported, including their types.

The package owns caption timers, Pick indicators, mounted content handles and resize observation. `reset` clears
transient UI/timers on task deactivation, coverage or failure; `dismiss` cancels address drafts. Page-scoped listeners
are bound once and expire with that page. Unmount removes handles/observers without closing profiles.

The host combines the returned page geometry with other native content and sends it to core for authorization,
zoom and clipping. Snapshot capture/decoding stays with Task view because PDF content shares that handoff. Native
attachment/visibility and profile storage/sign-in rules remain in [Profiles](../../docs/profiles.md).

The header notch uses custom concave geometry outside shadcn shapes. Narrow panes move Back, Forward and Reload
into the menu in that order; Pick and the menu stay reachable.

## The code

- `renderer/pane.tsx`: public factory, Stage definition and launcher presentation.
- `renderer/ProfilePane.tsx`, `ProfilePane.css`: pane/header and tab-bound drafts/dialogs.
- `renderer/state.tsx`, `pages.ts`: host boundary, transient state/handles and native geometry.
- `renderer/launchers.ts`: closed-profile opening actions.
