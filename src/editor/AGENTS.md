# Editor Kulisa package

Read README.md before changing document lifecycle or saving.

- Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`; halves share types only. Outside callers never reach internals.
- Main may use core atomic persistence (`main/files.ts`) and Project Explorer's public containment resolver. It imports
  no task/project/window/agent code. Roots, storage, notifications and action logging come from the caller.
- Renderer receives filesystem/desktop/question actions as callbacks and uses `@ui` for shipped components. Pierre's
  editor is lazy; keep text updates out of File props during an active edit session.
- Every save checks current roots and disk bytes. Preserve unsaved text on all failures. Bound source reads, drafts,
  open documents and retained editing histories. Cleanup belongs to file closure and session/task disposal.
- Unit tests run in plain Node. E2E tests live in `test/e2e/editor.spec.ts` and `resources.spec.ts`; follow docs/testing.md.
