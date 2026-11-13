# Project creation UI

The shared Agents → Code → Start sequence used by the welcome and task-window dialog. Core project/account
actions and folder policy belong to [tasks.md](../../../../docs/tasks.md#projects); window-wide UI constraints
belong to [ui.md](../../../../docs/ui.md).

## Boundary and lifecycle

Outside callers use only `index.tsx`: `NewProject` registers the dialog and `ProjectSetup` embeds creation in the
welcome. Drafts, step components and navigation are private; callers do not create or inspect them.
Dependency-cruiser protects the entry and keeps `draft.ts` independent of components/UI libraries.

Each creation surface owns a draft. Keep its values across Back/Continue; discard it when creation is cancelled.
Successfully installed CLIs and connected accounts belong to global stores and survive cancellation. Unmounting
an unfinished native SignIn cancels that attempt through the shared sign-in component.

The dialog refuses closure during creation or installation. Its content mounts only while open; the registered
dialog wrapper and installation state outlive the content. Keep the body scrollable independently of the footer,
fit the minimum window size and move focus to the new step heading after navigation.

## Steps and state

- **Agents** chooses exactly one connected account, simplifying the first experience without changing the project's
  multi-agent model. Each ready configuration has its own Use row; each provider has a separate New configuration
  row with Connect or Install. All Use actions advance directly to Code. Show origin and selectable configuration
  path. No detected-local row appears without native authentication. Commit discovery results together before
  revealing the table; do not insert rows under the pointer as requests finish. Rows have natural total height,
  fixed column widths and no independent vertical viewport; the step body owns scrolling.
- **Code** starts with one new folder, existing folder or repository URL. Expand settings inside the selected
  source card. New/clone paths show the parent picker, editable folder name and complete destination here. Browse
  selects the parent; Continue validates without creating/cloning. Keep edited folder names independently per source.
  Core returns current path refusals, and core creation repeats its checks rather than trusting the draft.
- **Start** derives a readable title-case display name from the selected folder/repository until the human edits
  it. Name edits must never rename the physical destination. Web app / CLI app / Not sure changes starter guidance
  only: do not persist a category, restrict which Stage panes can be opened, start profiles/terminals or submit an agent request.

Source-card selection headers use `Label` rather than FieldLabel's checked background (the author's choice).
Keep only radio/heading content in the label, with editable fields as sibling card content, so typing does not
activate the source selector.

Create stores the selected account with the project, then opens its first task. Do not offer Create again if
opening the task fails after the project was stored; refresh the project list instead. Optional core setup
failures remain owned/reported by the core. Installation/authentication/error UI uses shared agent controls.

## The code

- `index.tsx` is the public UI entry; `NewProject.tsx` owns dialog registration/closing and `ProjectSetup` owns
  the embedded draft.
- `ProjectFlow.tsx` owns navigation, heading focus and the bounded form; `draft.ts` owns derivation, validation and
  submission through IPC. The three step views edit that draft.
- Agent discovery/install and SignIn are shared with Settings; account ownership stays in main-process actions.
- Coverage: `test/e2e/empty-window.spec.ts`, `projects-delete.spec.ts`, `zoom-and-closing.spec.ts` and `agents.spec.ts`.
