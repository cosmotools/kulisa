# Browser: working in this folder

A Kulisa package: read `docs/packages.md` and this folder's `README.md`.

- Outside imports use `main/index.ts` and `ipc.ts`; there is no renderer half.
- Main code uses only `src/main/log.ts`, `files.ts` (atomic writes) and `local.ts` (address classification).
  Domain objects and their types are forbidden by dependency-cruiser.
- Hosts supply window, ownership key, profile configuration, persistence timing and cookie synchronization context.
  Task membership, sign-in policy, discard eligibility, menus and sending selections to agents stay in core.
- Preserve view/process lifetimes, saved formats, focus guards and deferred tab creation after destruction.
- Unit tests live here; behavioral tests and outside callers are listed in README, The code.
