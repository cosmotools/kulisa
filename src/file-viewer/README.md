# File Viewer

Read-only text, Markdown, PDF, images and audio/video display with extensible, lazy viewer registration. A
[Kulisa package](../../docs/packages.md) built with the application. Rendering and resource disposal belong here;
task authorization, selection and window state belong to the host. Dependency notices are covered by
[licensing](../../docs/LICENSING.md).

## Public boundary

`renderer/index.ts` exports `FileViewer`, `createViewerRegistry`, built-in descriptors and their public types.
It receives application facts through its inputs. A `FileSource` provides identity, name, byte size, optional MIME
and cancellable ranged reads. Change identity when content changes or a reload is requested. The host authorizes
filesystem reads and supplies metadata; the package never opens a path.
Abort signals invalidate asynchronous work even when a host cannot cancel an already dispatched read.
Unmount/source replacement disposes the engine and native/resource leases. Required host inputs are appearance,
`pdf` for native PDF, `media` for visibility and a streaming URL valid until its opening signal aborts, and
`document` for resolving/opening relative links.
`document.resolve` supplies another authorized `FileSource`; it does not grant directory access to the package.

`createViewerRegistry([...descriptors])` is the MIME-to-viewer configuration. A descriptor has an ID, MIME patterns,
optional fallback extensions/header probe, priority and lazy `load()`. Duplicate IDs replace
earlier registrations. Selection ranks specific exact MIME, specific wildcard MIME, a successful header probe,
then an extension for generic/unknown input, then inferred generic text. Priority breaks ties, then registration order.
Generic `text/plain` must not swallow CSV or replacement Markdown engines registered by extension.
Selection never loads engines. A bounded 1 KiB header recognizes PDF/image signatures and otherwise UTF-8 text when MIME is
absent/generic; individual engines still validate their full input. A suffix never proves valid contents.

Recognition reads files up to 64 KiB once and shares those bytes with the active engine; larger files use a 1 KiB
probe followed by the engine's bounded reads. The small snapshot follows the selected source's revision and is
released with it; there is no cache of previously opened files. A shared 200 ms deadline suppresses progress text
during quick recognition/read/decode stages. Available controls render while content is still opening, with PDF
search disabled until its native lease is ready. Progress replaces only the unfinished content area.

Add/register a descriptor to support another format or replace an engine. There is no central format switch or
closed all-formats enum. Controls belong to their engine.

`appearance` supplies shade and code font/size. The lazy text engine loads Editor's code palette through its public
entry. Layout and theme colors use Tailwind; toolbars use the existing `@ui` controls.
Image-sizing presets form a single-selection ToggleGroup;
custom zoom leaves the presets unselected. Surrounding application actions remain the host's.

## Implemented engines

- **Text:** Pierre's non-editing, virtualized single-file CodeView. UTF-8 only, at most 4 MiB and 100,000 lines;
  invalid UTF-8/binary controls are rejected. Selection/copy, wrapping and literal case-insensitive full-document
  search are supported. Search highlights/navigates matching lines and retains at most 10,000 occurrences, indicated
  by `+`; it does not depend on rendered DOM lines. Long lines have bounded syntax tokenization. HTML and other
  textual formats remain source text. No editor provider, drafts or writes.
- **Markdown:** lazy react-markdown with remark-gfm renders CommonMark, tables, task lists, strikethrough and
  footnotes as React elements, without raw HTML/MDX or `dangerouslySetInnerHTML`. This safe tree can share the
  Workbench document; arbitrary HTML reports still require their own isolation. Tailwind scopes typography to the
  article. Formatting accepts up to 256 KiB and 20,000 syntax nodes; Source switches to the existing Pierre engine
  with its larger limits, search and wrapping. HTTPS/HTTP links use the system browser. Relative links resolve
  against the document's directory, stay within this task's results, and open through the common preview action.
  Fragment links navigate existing footnote anchors. External/absolute images are not fetched; relative images use
  the same validation/Blob lifecycle as the image engine. A document reserves at most 32 images, 16 MiB of compressed
  bytes and 16 million pixels in aggregate before reads/decoding. Intrinsic dimensions are checked again. Invalid
  images show their alternative text and reason without hiding the report. Switching to Source or leaving releases
  image reservations, URLs and readers. Formatted content is read-only; source code blocks are plain monospace text.
- **PDF:** the renderer receives a `pdf` host adapter for opening, placement, disposal and search. `main/index.ts` supplies `NativePdf` for
  Electron. Call `registerViewerSchemes()` before app readiness, incorporating other schemes into that registration if
  needed: Electron permits only one registration call. A standard origin is required by Chromium's PDF toolbar;
  a nonstandard origin can display pages while leaving controls incomplete. Bytes must begin with `%PDF-` and fit
  32 MiB. Chromium handles pages, zoom and selection. Search uses Electron's public `findInPage` API;
  scanned pages without a text layer are not promised searchable.

- **Images:** Chromium `<img>` with a revocable in-memory Blob URL. PNG, JPEG, WebP, GIF (including animation),
  AVIF, BMP, ICO and SVG are supported when the shipped decoder accepts them. Source is bounded to 16 MiB, dimensions
  to 16 million pixels and 32,768 per side, checked with the MIT `image-size` header reader before decoding and
  with intrinsic dimensions afterward. Invalid/unsupported files show a system-opening fallback. Fit, fit width,
  100%, zoom and normal scrolling share a transparency checker background. Raster decoding and animation caches
  belong to Chromium; the pixel bound is not a fixed total-RAM guarantee. SVG is an image resource, never inserted
  into the Workbench document; scripts and external image resources cannot run/load in that mode.
  Switching/closure aborts reads, removes the image source and revokes its Blob URL; no disk copy or native view.

- **Audio/video:** lazy Chromium `<audio controls>` / `<video controls>` with the browser's player controls.
  No autoplay, picture-in-picture, converter or background playback.
  Extensions select a candidate; Chromium decides whether the container and codecs are supported. Decoder errors
  retain system opening. The host leases one unguessable `artifact-media:` URL per window in the Workbench session,
  never a profile session. `installMediaProtocol(session)` must run before that session's first window/network
  factory, after readiness; late installation produces `ERR_UNKNOWN_URL_SCHEME` in existing windows. The protocol
  serves GET/HEAD, single explicit/open/suffix byte ranges and 416 for invalid ranges. Each stream pulls at most
  256 KiB per read; Node's `Readable.from` / `toWeb` own backpressure and stream cancellation. Every read checks
  confinement and the original revision. There is no full-file
  buffer, file-size cap, HTTP server or disk preview copy. Chromium owns demuxing/decoder buffers and media caches;
  bounded reads are not a fixed total-RAM guarantee. Leaving, replacement, renderer failure/reload, deletion or window
  closure revokes the URL and aborts streams. Global shell coverage also disposes playback; returning never autoplays. Renderer disposal pauses playback, removes src and unloads the decoder.

The PDF native adapter has no preload, Node integration, profile session or filesystem access. One shared in-memory
session serves only live, unguessable document URLs; other requests except Chromium's internal PDF resources are
denied. Permissions, popups, navigation and downloads are refused. Built-in save/print workflows are outside this
integration; the host provides system opening. No HTTP preview server, converters or disk copies.
The adapter owns native views and retained PDF bytes; `close()` removes both. The host supplies bounds in CSS pixels,
an explicit native parent, owning UI zoom, brief overlay hiding and focus/key policy. The renderer follows position-only grid changes as well as resizes,
sending placement only when bounds change. A PDF uses Chromium's additional renderer processes; retain one native
view per window and close it when leaving its file/view/task instead of caching hidden documents.

## Kulisa integration

Task authorization belongs to `Task.readArtifact`; bounded regular-file/containment checks and revision metadata
belong to [Task Files](../task-files/README.md). Retention, sending, deletion and safe system opening stay in the core.
`main/artifact-viewer.ts` owns one PDF/media session per window and rejects stale requests after task changes.
Closing or replacing a PDF/media preview also cancels pending main-process reads before another chunk/allocation.
The renderer resolves document-relative names only against the task's existing artifact list; the common core
read/view actions enforce ownership, confinement and revisions. No separate path-resolution IPC is needed.
`Task.viewArtifact` owns the shared tree/thumbnail selection action; `task-view/Artifacts.tsx` supplies file/PDF/media/document
callbacks, appearance and host controls. Domain IPC stays in
`shared/ipc.ts`; `file-viewer/ipc.ts` contains only generic geometry/search data. The package imports no application
IPC helpers. Search logging omits the query.

Only the selected artifact's active Artifacts pane mounts a viewer. The task retains selection, not content, search
state or native processes, across view/task changes. Clicking the same row opens a fresh instance. Live revisions
replace changed content; unrelated list/thumbnail updates preserve the current viewer. File or parent-folder deletion
closes the selected PDF/media lease; list updates replace a removed file's preview with an unavailable state. The native view
participates in menu pictures, overlay hiding, focus guard and global keyboard routing. Preview/read channels serve
the human's surface; agents already receive paths and read with their own tools, so there is no duplicate MCP action.

Ordinary files in the results folder, including nested deliverables, need no registration. Temporary agent work
stays outside Artifacts under the core storage policy. HTML reports, diagrams, spreadsheets, Office and specialized
viewers remain deferred in
[issue #403](https://github.com/cosmotools/kulisa/issues/403), with engine references.

## Checks

`registry.test.ts` covers selection/recognition and whole-document search; `image.test.ts` covers image bounds,
format selection and read cancellation; `media.test.ts` covers range semantics, backpressure, cancellation and Markdown
budgets; `src/task-files/read.test.ts` covers
reads/containment. `test/e2e/file-viewer.spec.ts` covers Artifacts, virtualized search, native PDF search, isolation,
menu/view/task/deletion lifetimes. `image-viewer.spec.ts` covers
real image formats, tall-image controls, inert SVG, resource cleanup and selection races. Existing drag/send/system-opening
coverage remains in `agent-reports.spec.ts`. `markdown-media-viewer.spec.ts` covers GFM/source, linked-file
confinement, decoder playback, seeking, large-file ranges, stale revisions and disposal. Follow [testing](../../docs/testing.md).
`preview-loading.spec.ts` checks single reads of small files, delayed progress and usable controls during held reads.

## The code

- `renderer/registry.ts`, `viewers.ts`: contracts, recognition, registration and lazy engines.
- `renderer/FileViewer.tsx`, `FindBar.tsx`: loading/error lifecycle and shared search controls.
- `renderer/viewers/`: validation, bounded text search, drawing and native PDF lifecycle.
- `main/pdf.ts`, `main/media.ts`, `ipc.ts`: isolated PDF adapter, revocable media streaming and geometry/search contracts.
