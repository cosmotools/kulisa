# Settings UI

The window's settings cover, entity pages and shared page controls. Open/close, persistence and native-page
lifecycle belong to [window.md](../../../../docs/window.md#settings); entity rules belong to their core owners.
General UI/native-layer constraints: [ui.md](../../../../docs/ui.md).

## Boundary and lifecycle

Outside callers dynamically import `index.ts`; dependency-cruiser protects both the entry and lazy loading.
`Settings.tsx` owns the frame, categories, breadcrumbs and navigation to entity pages. There is no extra renderer
process; once loaded, the module stays in the window's memory.

Load the requested page before revealing it; agent discovery can refresh independently. Save pending fields before
navigation or closing. Changes from another window refresh lists without overwriting edits in progress.
Projects come from the window's pushed state. Profiles use a Query client owned by this Settings instance: reads
start on opening or a change event, with no polling, focus refresh or network-dependent waits. Concurrent reads
share a request; change events and mutation responses cancel obsolete reads in the renderer. Main-process IPC
still finishes. Closing Settings clears the cache and prevents late completions from starting more reads or
restoring discarded data. The first profile list and requested page must be ready before covering native pages.
The cover's back arrow closes Settings; entity navigation stays within categories. Navigation search is omitted
(the author's choice).

## Page controls

`kit.tsx` owns reusable entity rows and in-place addition. `Things` gives rows one identity and the same actions
through ⋯ and right-click; preserve `data-row`, `data-key` and the accessible name used by tests. Rows that open a
page also accept Enter; their own action controls must not activate row navigation.

Add items under their section rather than opening another settings window. Enter submits; Escape cancels the
addition before it can close Settings. Keep validation next to its field, with selectable error text. Entity
fields save immediately through their owner rather than a page-wide Save button.

Sonner's Toaster is at bottom left over the navigation's empty foot; the right side belongs to page actions.
The window-wide restriction on toast placement is in [ui.md](../../../../docs/ui.md#desktop-behavior). Log and installer output are
monospace `role="log"` surfaces; shadcn has no log-view component. Keep their rendering/retention bounded by the
log and installer owners instead of creating a component per line.

## The code

- `index.ts` is the lazy entry; `Settings.tsx` owns the frame and page lifecycle.
- `profiles-query.ts` owns profile requests and cache lifetime; `test/unit/settings-profiles.test.ts` covers races and cleanup.
- Entity pages own editing state and translate results from core actions. `kit.tsx` owns shared row/addition UI.
- `changed.ts` and account/discovery stores coordinate saving and updates across page lifetimes.
- Coverage: settings scenarios in `test/e2e/projects.spec.ts`, `profiles.spec.ts`, `agents.spec.ts`, `github.spec.ts`
  and `window.spec.ts`.
