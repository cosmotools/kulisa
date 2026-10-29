# Screenshots

A Kulisa package ([packages.md](../../docs/packages.md)): a picture of a page, one element, its visible part, or the
whole page down to its end (the OS's tools take pixels of the screen only). The human takes one to send it to someone
or to show the agent; the agent to check its work. Decided in issues #102 and #264; what is left: masking (issue #106), a native
thumbnail (issue #107).

It knows nothing of profiles, tasks or agents: it is given a Playwright page. Both the agent's `browser_screenshot`
and the human's ⋮ → Screenshot call `Task.screenshot`: capture, save the artifact and show its thumbnail.
`Profile.screenshot` checks the tab, passes its page here and logs the capture; `Task.saveArtifact` keeps the file
under the task's limit and updates Resources. The handles adapt their inputs and outputs (AGENTS.md, "One core").

## What is taken

| Kind | How |
|---|---|
| An element | `locator.screenshot()`, scrolled into view |
| The visible part | `page.screenshot()` |
| The whole page | `page.screenshot({ fullPage: true })` |

The whole page has the limits Chrome's own has: a page that scrolls inside a container of its own (Gmail, many admin
panels and single-page apps) gives its visible part only, and the container is taken as an element instead; lazy
images below the fold may stay empty; an endless feed only as far as it is loaded.

**Not the agent's marks.** Playwright draws the agent's pointer, its actions' outlines and `browser_highlight`'s in
its glass (`x-pw-glass`, a popover in the page's top layer); a stylesheet given to the screenshot (`style`) hides it
while the picture is taken. They are Kulisa's, not the site's.

**Not** (`Profile.screenshot`) while the human signs in (the sign-in pause: Playwright is detached), of a tab
showing a dialog (its page does nothing until it is answered), or of an empty tab. A page's size is its pane's, and
Chromium gives no picture of a page with none: a pane just opened is waited for while the window lays it out (a few
seconds at most), then the page's next frame; a pane never on screen yet, or a tab never in front (a hidden view
passes no size to its page), is refused saying so.

## The human

The pane's ⋮ → **Screenshot**: Element, Visible Part, Full Page, off on an empty tab (as Pick); Ctrl+Shift+S in a page
for Element (`keys.ts`). An element is chosen as Pick chooses (`chooseElement`, `picker.ts`: Playwright's
`page.pickLocator()`; Esc, Pick or the key again cancels; one choosing at a time in a profile). The picture is PNG at
the screen's density (`scale: 'device'`), sharp on a Retina screen. The window's handle is `tab:screenshot`
(`ipc/panes.ts`); a caption over the pane says it was copied and saved, or why not, and its thumbnail shows (below).

### Where it goes

**Both to the clipboard and to the task's artifacts.** `Task.saveArtifact` keeps the PNG in the same numbered,
size-limited folder as the agent's screenshots; Resources lists it with a small picture. Both belong to the task:
Delete in Resources or the thumbnail removes the file, as does deleting the task. The clipboard is for a message or
an agent's prompt (Ctrl+V); dragging the thumbnail into a folder keeps a copy outside the task.

Electron's clipboard is the W3C Clipboard API's (`clipboard.write([new ClipboardItem({ 'image/png': blob })])`;
`breaking-changes.md`): it has no `writeImage`.

## The thumbnail

For screenshots taken by the human or agent, as macOS shows one in the screen's corner: the picture just taken, in the bottom right corner of its pane, 20 CSS
pixels from its edges, at most 240 × 180 (a taller picture, as a whole page, its top only), framed by a thin ring and a
shadow so that it stands out of the page under it, for about 5 s; the pointer over it, or its menu open, holds it. One a window (`Thumbnails`, `main/thumbnail.ts`): the next takes its
place. The window makes it and tells it three things: where its panes are after every change of the grid (`place`,
with `AppWindow.paneBox`), that its pages are covered (`setHidden`), and that a task goes (`close`); it goes when its
pane is off screen.

- It fades in, and out when it goes by itself, by its × (in its top left corner, while the pointer is over it) or by
  its menu's Close (`fade`: its page's `thumbnail:fade`, then its view goes after `FADE`); taken away by
  Kulisa (the next picture, its artifact deleted, its pane off screen, its task going) it goes at once.
- A click opens the file in the OS's app for it (`shell.openPath`).
- Dragged, it carries the file itself (`webContents.startDrag`, as Electron's `tutorial/native-file-drag-drop.md`):
  into a messenger, a mail, the file manager.
- Its right-click menu: Show in Folder (`shell.showItemInFolder`), Copy (as PNG, including a JPEG screenshot),
  Send to Agent (the caller's `Task.sendArtifact`, as Resources: a shell-quoted path typed without Enter),
  Delete (the caller's `Task.deleteArtifacts`, as in Resources), Close.

**How it is drawn.** The pages are native views above the window's HTML (docs/ui.md), so the thumbnail is a
`WebContentsView` of its own page (`renderer/thumbnail.ts`; its `src/renderer/thumbnail.html` only loads it: Vite
builds no page outside its root), made when it shows and destroyed when it goes: one more process for those seconds,
about 21 MB (PSS; 10 MB of it its own; 94 MB RSS, Chromium's shared libraries mostly), next
to a window's 116 MB and a page's 57 MB. Weighed and not chosen: a window of its own over Kulisa's (Wayland does not let
a window be placed); the pages turned into pictures for its seconds (the human could not use the page meanwhile);
Electron's `ImageView` (a `View` drawing a `NativeImage`, no process: experimental in 44, and it gets no mouse, so no
click, menu or drag; issue #107). Its page gets a small picture (`preview`: twice the thumbnail's size), not the
whole page's megabytes. A view draws nothing outside its bounds, so its view is 12 px larger on every side than the
picture, transparent there, for the shadow (`PAD`): that band takes the page's clicks while it shows.

While a menu or a dialog covers the pages, they are pictures and the native views hidden, the thumbnail's too; the
window draws it in HTML over the pictures meanwhile (`renderer/ThumbnailPicture.tsx`, `#shotthumb`, from `thumbnail:place`),
so it does not vanish under its own menu. Its menu's rows are the package's (`thumbnailMenu`, `renderer/index.ts`), the
menu itself the window's (`menuAtPoint`, `lib/menu.ts`: the window's menus are its own components, and a menu would
not fit in the small view); its rows come back as `thumbnail:act`. All its channels are in `ipc.ts`, handled here.

## The agent

`browser_screenshot` (`kulisa-plugin/main/tools/browser.ts`): the visible part; `ref` or `locator` for one element;
`fullPage`; `also`, more profiles' active tabs in one call, each picture after its profile's name (with a `locator`,
the same element in each; a `ref` is one page's, refused with `also`). JPEG at CSS pixels (`scale: 'css'`): at a
screen's density the picture is several times larger and costs the agent's context for nothing. The pane's caption
shows "screenshot" for it, as for every command of the agent (`ghost.ts`); the human's pictures, taken through the
same connection, are not captioned: `ghost.ts` asks `takenByHuman`.

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process half's entry |
| `main/capture.ts` | a picture of a page, the agent's marks hidden; who took it |
| `main/clipboard.ts` | a screenshot copied to the clipboard, from its bytes or its file |
| `main/thumbnail.ts` | a window's thumbnail: its view, place, time, channels, what is done with its file |
| `renderer/index.ts` | the window half's entry: the thumbnail as the window draws it, its menu's rows |
| `renderer/ThumbnailPicture.tsx` | the thumbnail drawn in the window while the pages are pictures |
| `renderer/thumbnail.ts` | the thumbnail's own page: the picture, a click, a drag, a right-click, the pointer |
| `ipc.ts` | its channels |

Outside, using it: `Profile.screenshot` (`src/main/profiles.ts`), `browser_screenshot`
(`src/kulisa-plugin/main/tools/browser.ts`), `takenByHuman` in `ghost.ts`; the human's `tab:screenshot`
(`src/main/ipc/panes.ts`), `chooseElement` (`picker.ts`), the key (`keys.ts`), ⋮ → Screenshot (`src/renderer/components/grid/ProfilePane.tsx`) and
`screenshot` (`src/renderer/lib/store.ts`); the window's `thumbnails` (`window.ts`: made, placed, hidden, closed),
`<Thumbnail />` and `thumbnailMenu(menuAtPoint)` (`components/App.tsx`), `Task.sendArtifact` (Send to Agent, as Resources), the page's
shell `src/renderer/thumbnail.html` (`vite.config.mts`). Its e2e tests, on the test site's `/tall`:
`test/e2e/agent-tools.spec.ts` ("agent: screenshots of an element, …"), `profiles.spec.ts` ("a pane's ⋮ → Screenshot …", "a screenshot shows its
thumbnail …").
