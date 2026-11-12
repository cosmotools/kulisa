# Editor

Editable UTF-8 project files, recoverable drafts and autosave. A [Kulisa package](../../docs/packages.md); the caller
supplies current allowed roots, a task-owned storage directory, action logging, notifications and desktop opening.
The editor knows no task, project, window or agent. Project Explorer remains independent of document lifetimes.
The public renderer entry also lazily supplies its code theme to host-owned read-only surfaces; no editor/saving
lifecycle is required to share the palette.

## Documents and saving

Opening a text file selects one of up to twelve documents; files are limited to 1 MiB. The main half reads bounded
regular files, rejects invalid UTF-8 and binary control bytes, and checks containment through Project Explorer's
public resolver before reading and saving. Unsupported text encodings, binary content and oversized files return
an external-opening result; the core retains its existing refusal to execute programs through desktop opening.

The renderer sends input immediately; the core checkpoints the received draft atomically before scheduling an
autosave after 600 ms without further input. Document actions are serialized in both halves. Autosave and drafts belong to
the core so switching Activity bar items or tasks does not stop saving. Unload flushes received edits; interrupted
or refused saves retain recovery drafts. An abrupt crash before the core receives/checkpoints an input can lose that input.

Each write compares a SHA-256 of the current bytes with the document's base version. External writers do not share
a lock: there is a small compare-to-rename race; this is optimistic conflict detection, not filesystem transactions.
Atomic replacement preserves source permissions and BOM. Pierre's document model preserves the file's line endings.
Temporary source files use the core atomic writer and are removed on failure; source reads never execute converters.

Only the visible selected document polls, every two seconds. A clean changed document reloads with a new generation;
a dirty document keeps its text and pauses autosave. Comparison shows the current disk version against the draft.
Use disk version or Keep my changes checks the exact disk revision shown before accepting the choice; another disk
change refuses that choice. Deleted or inaccessible files keep their drafts, with Retry and Copy text. Opening or
selecting a background document checks it again. Closing attempts autosave and asks before discarding refused writes.
The file-tab menu's Close All closes the current tabs in order using the same save/discard checks; cancelling a
discard question stops the remaining closures. Tabs opened after the action starts are left open.

## Ownership and recovery

The supplied `editor/` directory belongs to the task: `tabs.json` keeps ordered paths and selection; one SHA-256-named
JSON per dirty document keeps text, base bytes as text, source metadata and revision. Clean source text is not stored.
Files use mode 0600. Reopening reads source files afresh, reconciles drafts with current roots/disk, and resumes safe
autosave; it never recreates a missing source file. Successful save or explicit discard removes its draft; deleting
the task/project removes the entire directory through the core's existing deferred folder cleanup.

The twelve-document and 1 MiB limits bound stored drafts and live documents. JSON escaping and base text can make
recovery files larger than source bytes. Undo history has 100 entries per file in the current runtime and is not
durable. Pierre's `editStateKey` and `EditStateManager` retain documents, undo/redo, selections and scroll between
mounts. The session owns only keys: each file/caller/source generation gets a unique identity, including when the
same source is open in two tasks. Reload, file closure and session disposal clear their entries; active entries
are cleared after Pierre releases them at completion. The shared cache capacity follows the callers' twelve-file
limits so another task cannot evict an open file's history. Selection and scroll survive file/Activity bar/task
changes in the same window. Keep the virtualizer mounted across file and comparison switches: detaching it before
the editor's completion checkpoint loses its viewport. No separate application copy of editing/view state is kept.
Restart restores files and drafts, with fresh undo history and cursor state.

The editable surface is a lazy renderer chunk; it adds no process or highlighting worker. Pierre owns input,
selection, syntax, undo/redo and search/replace. Shadcn supplies controls without changes to `src/ui`. The code surface
uses JetBrains-style colors (the author's choice): JetBrains Dark and IntelliJ Light. Their small
palette is adapted from IntelliJ Platform's [Dark scheme](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/expUI/expUI_darkScheme.xml)
and [Light scheme](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/expUI/expUI_lightScheme.xml).
`renderer/appearance.ts` owns both palettes and registers their literal colors as two TextMate themes for the
Shiki JavaScript backend. Background and gutter variables are scoped to the editor container from the supplied
shade; the package does not read the window stylesheet or document root. Pierre's live tokenizer requires RGBA
colors: its CSS-variable palette produces nearly transparent tokens while editing. Select a single theme by the caller's shade: a dual-theme render cache
can keep the old surface colors while the live tokenizer switches. Merely changing inherited CSS variables cannot
update that tokenizer. `unsafeCSS` styles the gutter inside its
shadow root. Shiki's JavaScript engine also works within the window's CSP, which blocks WebAssembly compilation.
This is a syntax palette, without JetBrains' semantic analysis.
The active row uses a soft background without a border; selections are rectangular and matching brackets use a fill.
Bundled JetBrains Mono has ligatures off and a 1.4 line-height multiplier. The caller supplies visibility, shade and
text size; hidden views do not poll.

The supported JetBrains key bindings are Ctrl/Cmd+R for Replace, Shift+Enter for a new line below,
Alt+Shift+Up/Down for moving lines, Ctrl+Shift+/ for block comments on Windows/Linux and Cmd+Alt+/ on macOS.
Find, undo/redo and line comments already share their usual shortcuts. This is not the entire JetBrains keymap:
Pierre does not expose duplicate-selection or delete-line commands with the same semantics, so Ctrl/Cmd+D and
Ctrl+Y retain Pierre's defaults. The keymap uses only its public commands and adds no keyboard interception.
Each file/comparison's virtualizer owns its bounded scroll root. Wrapping it in an unconstrained scrolling parent
would make the entire document visible to virtualization. Pierre restores scroll on attachment. Take native focus
before it replaces the virtualized rows, so the editor can retain focus for offscreen carets and a blank final line.

The host may await `session.drain()` before closing its UI to finish already submitted actions. Core disposal
flushes received edits independently of renderer survival; this does not collect arbitrary panel state at shutdown.

## The code

- `main/workspace.ts`, `main/index.ts`: bounded reads, durable drafts, serialized document actions and autosave.
- `ipc.ts`: document/action/result contracts; task channels live in the core's shared IPC table and handles.
- `renderer/session.ts`, `renderer/index.ts`: caller-owned state, ordered input, retained-state cleanup and lazy view.
- `renderer/Editor.tsx`: Pierre editing/comparison, file tabs, save status and conflict/error controls.
- `renderer/appearance.ts`: syntax palette mapping, editor CSS and the supported JetBrains keyboard bindings.
- `editor.test.ts`: filesystem and recovery invariants; `test/e2e/editor.spec.ts` and `resources.spec.ts`: window flows.
