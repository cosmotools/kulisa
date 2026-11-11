# The welcome

First-start introduction to Kulisa as an agentic IDE, with web and CLI examples, followed by the shared project
creation UI. It starts no browser or terminal processes. Empty-window/project behavior belongs to [tasks](../../../../docs/tasks.md#projects);
shared UI constraints belong to [ui.md](../../../../docs/ui.md).

## Boundary and lifecycle

Outside callers use only `Welcome.tsx`; dependency-cruiser protects the entry. Examples, characters, photographs
and animation CSS stay here. App branding and the project creation UI belong to their own owners.

Mount only while the welcome is shown. Short/narrow windows omit illustrations and the supporting feature row;
at up to 600 CSS px high the introduction is one column at every width. Keep the introduction usable at 640 × 400.
At up to 1000 CSS px high, reduce outer padding and section gaps so both full examples fit the initial window
([window size](../../../../docs/window.md#the-windows-size)).
Project creation owns its inputs and scrolling; first-start focus moves from Create a project to its form.

## Demonstrations

The shop shows Customer and Admin browser identities linked by order #1042. Both pages keep a 1120 × 656 desktop
layout scaled into their frames. One ResizeObserver on the pair updates scale and character coordinates and
disconnects on unmount. Product photographs are bundled, never fetched at runtime; surfaces use theme tokens.

One 20-second CSS clock in `animations.css` coordinates scrolling, clicks, selections, captions and the generic
coding-CLI transcript. The character finishes Customer, then moves to Admin while Customer holds its result.
The transcript presents familiar requests, edits, tool calls/results and an input prompt for the user's chosen
CLI; it must not suggest that Kulisa supplies a replacement coding agent.

The CLI example shows a coding agent under development in a Stage terminal: launch, a coding request, file access,
a diff and a checked response. Its 960 × 360 layout scales through one ResizeObserver. `DemoAgent` is shared by
both examples. Both tab panels share one grid cell and remain in layout, with the inactive drawing invisible and
inert; reserve the CLI caption's space too so switching never moves the frame or introduction. Pause inactive
drawings and remount the examples and lower transcript when switching so their clocks restart together.

Pause freezes the whole active cycle; reduced motion shows its final result. `CoffeeBreak` shares that clock:
the person reclines and drinks coffee, with upper body/chair rotation at the hips and feet supported by the
ottoman. Narrow/short windows omit the vignette. No JavaScript animation timer or hidden live environment is retained.
These coordinated timelines are the reason for custom keyframes rather than independent component animations.

Photo attribution is in `assets/CREDITS.txt`; Vite imports photographs from this folder and emits the credits as
`welcome-photography-CREDITS.txt`. Keep attribution beside the owned assets.

## The code

- `Welcome.tsx` owns introduction/example selection and the handoff to project creation.
- `WebExample.tsx`, `CliExample.tsx` and `AgentTerminal.tsx` draw the shared work area; the characters and
  `animations.css` keep one demonstration clock.
- `assets/` owns bundled images and credits. No example depends on network content.
- Coverage: `test/e2e/empty-window.spec.ts` and `zoom-and-closing.spec.ts`.
