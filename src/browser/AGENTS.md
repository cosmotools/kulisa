# Browser

Read `README.md` and `docs/packages.md`.

- Entries: `main/index.ts`, `ipc.ts`; no renderer. Allowed core imports: `log.ts`, `files.ts`, `local.ts`.
- Hosts supply the window, ownership key, profile configuration, persistence timing and cookie-sync context.
  Task membership, sign-in policy, discard eligibility, menus and agent selections stay in core.
- Preserve view/process lifetimes, saved formats, focus guards and deferred tab creation after destruction.
- Unit tests are here; integration tests and callers: README, The code.
