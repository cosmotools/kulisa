# File Viewer

Read-only file display with extensible, lazy viewer registration. A [Kulisa package](../../docs/packages.md),
extractable as a React library with a separate optional Electron adapter. It uses the repository's build and
existing dependencies; it is not independently published. GPL-3.0-or-later applies; extraction does not select another
license. Pierre carries Apache-2.0; Electron/Chromium retain their bundled notices.

## Public boundary

`renderer/index.ts` exports `FileViewer`, `createViewerRegistry`, built-in descriptors and their public types.
It imports no application state, domain types, IPC bridge, UI components or global stylesheet. A `FileSource`
provides identity, name, byte size, optional MIME and cancellable ranged reads. Change identity when content changes
or a reload is requested. The host authorizes every read and supplies metadata; the package never opens a path.
Abort signals invalidate asynchronous work even when a host cannot cancel an already dispatched read.
Unmount/source replacement disposes the engine and native lease.

`createViewerRegistry([...descriptors])` is the MIME-to-viewer configuration. A descriptor has an ID, MIME patterns,
optional fallback extensions/header probe, priority, capability availability and lazy `load()`. Duplicate IDs replace
earlier registrations. Selection ranks specific exact MIME, specific wildcard MIME, a successful header probe,
then an extension for generic/unknown input, then inferred generic text. Priority breaks ties, then registration order.
Generic `text/plain` must not swallow future CSV/Markdown engines registered by extension. An explicit viewer ID selects only an eligible
match. Selection never loads engines. A bounded 1 KiB header recognizes PDF/image signatures and otherwise UTF-8 text when MIME is
absent/generic; individual engines still validate their full input. A suffix never proves valid contents.

Add/register a descriptor to support another format or replace an engine. There is no central format switch or
closed all-formats enum. Controls belong to their engine; PDF search is an optional lease capability. Future
page/sheet/media capabilities should remain optional rather than requiring a universal page model.

`appearance` supplies shade, code font/size and optional registered Pierre theme names. Scoped CSS owns portable
standard HTML controls: the author's extraction requirement excludes `@ui` and Tailwind dependencies. The host can
set `--file-viewer-background`, `--file-viewer-foreground`, `--file-viewer-border`, `--file-viewer-selected` and
`--file-viewer-selected-text` through `style`. Surrounding application actions remain the host's.
`fallback` supplies optional content alongside unsupported/read/engine errors.

## Implemented engines

- **Text:** Pierre's non-editing, virtualized single-file CodeView. UTF-8 only, at most 4 MiB and 100,000 lines;
  invalid UTF-8/binary controls are rejected. Selection/copy, wrapping and literal case-insensitive full-document
  search are supported. Search highlights/navigates matching lines and retains at most 10,000 occurrences, indicated
  by `+`; it does not depend on rendered DOM lines. Long lines have bounded syntax tokenization. Markdown, HTML and
  other textual formats are source text; nothing executes them. No editor provider, drafts or writes.
- **PDF:** the renderer accepts an explicit `capabilities.pdf` host adapter. `main/index.ts` supplies `NativePdf` for
  Electron. Call `registerPdfScheme()` before app readiness, incorporating other schemes into that registration if
  needed: Electron permits only one registration call. A standard origin is required by Chromium's PDF toolbar;
  a nonstandard origin can display pages while leaving controls incomplete. Bytes must begin with `%PDF-` and fit
  32 MiB. Chromium handles pages, zoom and selection. Optional `find` uses Electron's public `findInPage` API;
  scanned pages without a text layer are not promised searchable.

- **Images:** Chromium `<img>` with a revocable in-memory Blob URL. PNG, JPEG, WebP, GIF (including animation),
  AVIF, BMP, ICO and SVG are supported when the shipped decoder accepts them. Source is bounded to 16 MiB, dimensions
  to 16 million pixels and 32,768 per side, checked with the MIT `image-size` header reader before decoding and
  with intrinsic dimensions afterward. Invalid/unsupported files show a system-opening fallback. Fit, fit width,
  100%, zoom and normal scrolling share a transparency checker background. Raster decoding and animation caches
  belong to Chromium; the pixel bound is not a fixed total-RAM guarantee. SVG is an image resource, never inserted
  into the Workbench document; scripts and external image resources cannot run/load in that mode.
  Switching/closure aborts reads, removes the image source and revokes its Blob URL; no disk copy or native view.

The native adapter has no preload, Node integration, profile session or filesystem access. One shared in-memory
session serves only live, unguessable document URLs; other requests except Chromium's internal PDF resources are
denied. Permissions, popups, navigation and downloads are refused. Built-in save/print workflows are outside this
integration; the host provides system opening. No HTTP preview server, converters or disk copies.
The adapter owns native views and retained PDF bytes; `close()` removes both. The host supplies bounds in CSS pixels,
brief overlay hiding and focus/key policy. The renderer follows position-only grid changes as well as resizes,
sending placement only when bounds change. A PDF uses Chromium's additional renderer processes; retain one native
view per window and close it when leaving its file/view/task instead of caching hidden documents.

## Kulisa integration

Task authorization belongs to `Task.readArtifact`; bounded regular-file/containment checks and revision metadata
belong to [Task Files](../task-files/README.md). Retention, sending, deletion and safe system opening stay in the core.
`main/artifact-viewer.ts` binds one native adapter to a window and rejects stale requests after task changes.
`Task.viewArtifact` owns the shared tree/thumbnail selection action; `task-view/Artifacts.tsx` supplies source/capability callbacks, appearance and host controls. The host lazily supplies
Editor's code palette for text; the portable package depends on neither Editor nor its styles. Domain IPC stays in
`shared/ipc.ts`; `file-viewer/ipc.ts` contains only generic geometry/search data. The package imports no application
IPC helpers. Search logging omits the query.

Only the selected artifact's active Artifacts pane mounts a viewer. The task retains selection, not content, search
state or native processes, across view/task changes. Clicking the same row opens a fresh instance. Live revisions
replace changed content; unrelated list/thumbnail updates preserve the current viewer. File or parent-folder deletion
closes the selected PDF; list updates replace a removed file's preview with an unavailable state. The native view
participates in menu pictures, overlay hiding, focus guard and global keyboard routing. Preview/read channels serve
the human's surface; agents already receive paths and read with their own tools, so there is no duplicate MCP action.

Ordinary files in the results folder, including nested deliverables, need no registration. Temporary agent work
stays outside Artifacts under the core storage policy. Text, PDF and images complete the scope of
[issue #393](https://github.com/cosmotools/kulisa/issues/393). Formatted reports, spreadsheets, audio/video, Office and
specialized viewers remain deferred in [issue #403](https://github.com/cosmotools/kulisa/issues/403), with engine references.

## Standalone example and checks

`examples/file-viewer` imports only the public renderer entry. Run `npm run example:file-viewer`, then serve
`dist/file-viewer-example` with an external static server, for example
`python3 -m http.server 4175 --bind 127.0.0.1 --directory dist/file-viewer-example` and open `http://127.0.0.1:4175`.
`npm run build` also builds it. It uses browser File reads, includes a custom `.example` viewer and intentionally has
no native PDF capability. It has no task/store/preload. Sources and built example are excluded from installers.

`registry.test.ts` covers selection/recognition and whole-document search; `image.test.ts` covers image bounds,
format selection and read cancellation; `src/task-files/read.test.ts` covers
reads/containment. `test/e2e/file-viewer.spec.ts` covers Artifacts, virtualized search, native PDF search, isolation,
menu/view/task/deletion lifetimes and standalone registration/cancellation/closure. `image-viewer.spec.ts` covers
real image formats, tall-image controls, inert SVG, resource cleanup and the independent image consumer. Existing drag/send/system-opening
coverage remains in `agent-reports.spec.ts`. Follow [testing](../../docs/testing.md).

## The code

- `renderer/registry.ts`, `viewers.ts`: contracts, recognition, registration and lazy engines.
- `renderer/FileViewer.tsx`, `FindBar.tsx`, `viewer.css`: loading/error lifecycle and independently themed controls.
- `renderer/viewers/`: validation, bounded text search, drawing and native capability lifecycle.
- `main/pdf.ts`, `ipc.ts`: optional isolated Electron adapter and portable data shared between its halves.
