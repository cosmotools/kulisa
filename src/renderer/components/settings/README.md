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

The breadcrumb bar spans the content area's width at its top, with a bottom border, outside the page's
scrolling content. Page actions belong to `SettingsHeading` below the bar. Settings pages center a column
capped at 680 px, except the log, which fills the available width and height (the author's choice). Its
filters/actions wrap and the page scrolls when space is limited. Navigation collapses to named icons below the
small breakpoint. Field controls move below their labels in narrow groups.

`kit.tsx` owns the shared heading, `SettingsGroup` boundary, `SettingsFields` and `Things`. Group headers sit above
the surface. A wrapper owns the rounded border and clipping because `ItemGroup` has no surface variant. Lists use
`Item`/`ItemGroup` with `ItemSeparator`s inset 16 px on each side and no inter-row gaps. Field rows use the same
inset with `Separator`, keeping validation beside its field. Grouped rows paint hover/focus on a square wrapper;
the outer group clips the first and last rows to its rounded corners. Preserve row actions and keyboard navigation.
Account configuration details belong to the account's row, with connection controls below the list.

The Settings cover scopes its neutral palette through `#settings` in `window.css`: navigation and canvas share
one background, with a lighter surface for groups in dark mode. Hover/selection use a brighter tone;
navigation shares the content's foreground and state tokens. Body and secondary text target WCAG AA contrast
(at least 4.5:1) on surfaces and hover states. Light mode follows the same roles. Generated controls keep semantic tokens.

## The code

- `index.ts` is the lazy entry; `Settings.tsx` owns the frame and page lifecycle.
- Entity pages own editing state and translate results from core actions. `kit.tsx` owns shared row/addition UI.
- `changed.ts` and account/discovery stores coordinate saving and updates across page lifetimes.
- Coverage: settings scenarios in `test/e2e/projects.spec.ts`, `profiles.spec.ts`, `agents.spec.ts`, `github.spec.ts`
  and `window.spec.ts`.
