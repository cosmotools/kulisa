# Agent management

Installed CLIs and account configurations for New Project, Settings and task choices. `Accounts` owns records,
discovery/cache, installation and sign-in lifecycle. Entries: `main/index.ts`, `renderer/index.ts`, `ipc.ts`.
[Kulisa plugin adapters](../kulisa-plugin/README.md#agent-adapters) retain CLI-specific behavior; core supplies
eligible choices, project usage and deletion approval. Project/task state and UI navigation remain outside.

## Constraints

- `agents.json` records configurations. Owned directories are `agents/<agent>-<id>/`, never renamed because macOS
  keychain identity depends on their paths. Legacy records without an origin remain owned. External connections
  reference existing files/login/settings directly; disconnect never signs out or deletes their directories.
- Discovery and connection both check native authentication. Match canonical directory plus override mode, reject
  managed storage even through aliases, and preserve an absent configuration variable: explicitly setting Claude's
  default directory selects different metadata. Matching email does not merge external and owned configurations.
- Reserve cancellation before discovery/startup. New sign-in uses an empty owned folder and the CLI's login in a
  temporary terminal; the system browser handles authentication without a `BROWSER` override. Confirm native status;
  duplicate owned email reuses that account. Failure, cancellation or duplication signs out if necessary and removes
  the new folder, including stopping a terminal created after cancellation. Completed connections outlive drafts.
- Core checks task use and confirms deletion before dropping records and disposing owned files. Native logout
  removes credentials outside the directory too. Locked folders use the caller's deletion journal; startup removes
  abandoned sign-in folders and legacy `accounts.json`.
- Search registered adapters only. Cache at most 256 refreshed agent/folder results, deduplicate probes across
  accounts, then refresh cached renderer lists. Installation streams to its originating window, rechecks the CLI
  and returns full output because stream/result ordering is not guaranteed. CLIs remain user-owned and self-update.

## Integration

Package IPC handles listing, discovery, connection, installation, opening configuration folders and cancelling
sign-in. Core retains `account:signin:start`, `account:delete` and task choices because they apply project/task rules.
Shared renderer state has no UI dependencies; native terminal loading is deferred so unit tests run in plain Node.

Outside callers: `main/{app,shell}` construct/expose `Accounts`; `main/ipc/agents.ts` supplies context and membership.
Window `components/{AgentPicker,AgentSetup,new-project,settings}` retain presentation/selection/navigation.
`shared/{ipc,types}` joins contracts; `.dependency-cruiser.ts` enforces entries and core independence.
The e2e fixture observes running sign-in terminals; `test/unit/drawing.ts` must type-check in Node and test projects.
Package/task catalogs and browser/plugin docs retain ownership pointers; `shared/paths.ts` updates its moved reference.

## The code

- `main/accounts.ts`: configuration ownership, native actions, discovery cache and sign-in cleanup.
- `main/index.ts`, `ipc.ts`: public entry, caller context and channel contracts.
- `renderer/`: shared list/install state and existing-configuration hooks.
- `accounts.test.ts`, `management.test.ts`: storage and asynchronous cancellation/failure. Window coverage remains
  in `test/e2e/{agents,empty-window,projects}.spec.ts` and task/terminal scenarios; adapter tests stay in Kulisa plugin.
