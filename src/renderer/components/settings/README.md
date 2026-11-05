# Settings UI

The window's settings cover, entity pages and shared page controls. Open/close, persistence and native-page
lifecycle belong to [window.md](../../../../docs/window.md#settings); entity rules belong to their core owners.
General UI/native-layer constraints: [ui.md](../../../../docs/ui.md).

## Boundary and lifecycle

Callers dynamically import `index.ts`; dependency-cruiser protects the entry and lazy loading. `Settings.tsx`
owns the frame, categories and navigation. The module stays in the window's renderer; no extra process.

Reveal known content immediately; independent reads show named spinners, then data/errors. Unknown counts and
empty states wait for data. `read.ts` keeps known values during refresh and ignores replies after a newer read,
edit or unmount. Save before navigation/closing; disable project fields until their initial settings arrive.
Cross-window refreshes preserve edits. Back closes Settings; entity navigation stays within categories.
Navigation search is omitted (the author's choice).

## Page controls

`kit.tsx` owns rows and in-place addition. `Things` shares actions between ⋯ and right-click; preserve `data-row`,
`data-key` and accessible names. Enter opens rows; their own controls must not trigger navigation.

Add under the owning section: Enter submits, Escape cancels before closing Settings. Keep selectable validation
beside its field. Entity fields save immediately through their owner; there is no page-wide Save button.

Sonner's Toaster sits over navigation's bottom-left foot; page actions occupy the right. See
[toast constraints](../../../../docs/ui.md#desktop-behavior). Log/installer output uses monospace `role="log"`
surfaces: shadcn has no log viewer. Their owners bound rendering/retention; avoid per-line components.

The full-width breadcrumb bar has a bottom border outside scrolling content; headings/actions sit below it.
Center pages at 680 px, except Log, which fills the available area (the author's choice). Wrap filters/actions
and scroll when space is limited. Below the small breakpoint navigation shows named icons; narrow fields stack.

`SettingsGroup` owns a transparent border with `md` corners and clipping: `ItemGroup` has no surface variant.
Headers sit above it; Log uses the same border/radius. `Things` composes `Item`/`ItemGroup` with no gaps and 16 px
inset `ItemSeparator`s; `SettingsFields` uses the same inset with `Separator`. Square hover/focus wrappers follow
the outer group's corners. Keep account configuration within its row and connection controls below the list.

Use global theme tokens, including generated controls; avoid a Settings palette. Transparent groups and smaller
corners are the author's choice.

## The code

- `index.ts` is the lazy entry; `Settings.tsx` owns the frame and page lifecycle.
- Entity pages own editing state and core calls; `kit.tsx` owns shared fields, rows and addition UI.
- `changed.ts` and account/discovery stores coordinate saving and updates across page lifetimes.
- Coverage: settings scenarios in `test/e2e/projects.spec.ts`, `profiles.spec.ts`, `agents.spec.ts`, `github.spec.ts`
  and `window.spec.ts`.
