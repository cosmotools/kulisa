# Screenshots

Page, viewport and element capture, a [Kulisa package](../../docs/packages.md). Callers supply a Playwright page;
profiles/tasks/agents stay outside. Masking: #106; native thumbnails: #107.

Human and agent handles call `Task.screenshot`: `Profile.screenshot` checks the tab and captures;
`Task.saveArtifact` routes results and temporary captures according to [task storage](../../docs/tasks.md#artifacts-and-temporary-files), updating the Artifacts [Side bar](../../docs/ui.md#workbench-terminology)
and showing the thumbnail for results.

## What is taken

| Kind | API |
|---|---|
| Element | `locator.screenshot()`, scrolling into view |
| Visible part | `page.screenshot()` |
| Whole page | `page.screenshot({ fullPage: true })` |

Full-page capture cannot expand inner scrolling containers; capture those as elements. Lazy images and endless
feeds include only loaded content. Screenshot `style` hides Playwright's `x-pw-glass` action/highlight overlay.

Core refuses sign-in mode, open dialogs and blank tabs. Capture needs pane dimensions: wait briefly for a new pane's
layout and next frame, but refuse never-shown panes/tabs that have no size.

## The human

Pane ⋮ → Screenshot offers Element, Visible Part, Full Page; blank tabs disable it. Ctrl+Shift+S selects an element
through Pick's `chooseElement`; Esc, Pick or the shortcut cancels. Only one selection per profile.
`tab:screenshot` returns a PNG at device density, with a pane caption and thumbnail.

### Where it goes

Copy to clipboard and save in the task's artifacts folder. Deletion from the Artifacts
Side bar or the thumbnail, and task deletion, remove the artifact; dragging out creates an independently owned copy.
Use Electron's W3C Clipboard API (`ClipboardItem` with `image/png`), not `writeImage`.

## The thumbnail

One `Thumbnails` instance per window; a new capture replaces the previous one. Place the preview at its pane's
bottom-right, 20 CSS px inset, at most 240 × 180; tall images show their top. Auto-close after about 5 s, paused by
hover or menu. The caller supplies placement (`place`), covered-page state (`setHidden`), task close and file actions.

- Fade on timeout, × or Close; remove immediately on replacement, artifact deletion, hidden pane or task close.
- Click invokes the caller’s artifact-opening callback, selecting the same Artifacts viewer as a tree row;
  drag uses `webContents.startDrag`. The caller supplies task authorization; the package owns no task lookup.
- Menu: Show in Folder, Copy as PNG (including JPEG sources), Send to Agent, Delete, Close. Sending uses the caller's
  `Task.sendArtifact`; deletion uses `Task.deleteArtifacts`.
- Native profile views cover window HTML, so use a temporary `WebContentsView`. Destroy it when dismissed.
  Pass a preview twice the display size, not the full image. Its transparent 12 px shadow padding intercepts clicks.
- The extra renderer costs memory; #107 tracks `ImageView`, whose lack of mouse input prevents current click/menu/drag
  behavior. Wayland also prevents positioning a separate overlay window.
- While pages are covered by snapshots, hide its native view and draw `ThumbnailPicture` in window HTML. Package
  `thumbnailMenu` supplies rows to the window's `menuAtPoint`; `thumbnail:act` returns actions. All channels live here.

## The agent

`browser_screenshot` supports viewport, `ref`/`locator`, `fullPage`, and `also` for active tabs in several profiles.
A locator can apply to all; a page-owned ref cannot combine with `also`. Return labelled JPEGs at CSS density to
limit context size. The default purpose saves in the caller’s temporary folder; `purpose: artifact` saves a requested
result in Artifacts and shows the thumbnail. `ghost.ts` captions agent captures; `takenByHuman` suppresses captions for human captures.

## The code

- `main/index.ts`, `renderer/index.ts`, `ipc.ts`: public entries and channels.
- `main/`: capture/clipboard and thumbnail lifecycle; `renderer/`: native preview page, snapshot substitute and menu rows.
- Core owns tab eligibility (`Profile.screenshot`), artifacts (`Task`), Pick and keyboard/menu triggers. The plugin
  owns `browser_screenshot` and human-capture annotation suppression.
- `window.ts` supplies placement/coverage/task lifecycle; `App.tsx` supplies shared menus/prompt actions.
  `src/renderer/thumbnail.html` is Vite's loader shell.
- E2e: `test/e2e/agent-tools.spec.ts`, `profiles.spec.ts`, using `/tall` for full-page/element coverage.
