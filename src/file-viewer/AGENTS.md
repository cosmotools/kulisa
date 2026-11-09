# File Viewer Kulisa package

Read README.md before changing selection, resource limits or native lifecycle.

- Entries: `renderer/index.ts`, `main/index.ts`, `ipc.ts`. Halves share types only. No imports from other Kulisa
  packages, shared domain types, core/window/preload, application IPC bridge or global styles.
- The host supplies authorized ranged reads, metadata, appearance, surrounding actions and optional native
  capabilities. Scoped standard HTML controls preserve the author's independent-extraction requirement;
  do not introduce `@ui` or Tailwind dependencies.
- New engines are lazy descriptors registered through the public API. Keep validation, limits, optional controls,
  cancellation and disposal with the engine. No central format switch or closed all-formats union.
- Native PDF receives authorized bytes, never a path. Preserve its isolated in-memory session, request/permission/
  navigation restrictions and one active view per host. Dispose URLs, buffers, find listeners, animation frames and
  webContents on replacement/closure.
- Images use Chromium as decoder; keep compressed-byte/header/intrinsic-pixel bounds before/after decode, SVG in
  image mode and Blob URL disposal with the engine. Do not add a native view or store image copies.
- Source invalidation must defeat stale asynchronous results. Do not reuse the project's saving editor.
- Keep the standalone example using public entries and passing its production build. Extend synthetic viewer and
  lifecycle checks when contracts change. Plain Node tests stay here; real-app tests in
  `test/e2e/file-viewer.spec.ts` follow docs/testing.md.
- Current repository licensing applies. npm publication or relicensing requires the author's request.
