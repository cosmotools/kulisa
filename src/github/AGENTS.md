# GitHub

Read `README.md` and `docs/packages.md`. Design: #48.

- Entries: `main/index.ts`, `ipc.ts`; no renderer. Allowed core imports: `ipc.ts`, `log.ts`, `store.ts`, `files.ts`.
- Projects, repository/account bindings, deletion questions and opening pages belong to callers (`projects.ts`,
  `app.ts`). Remote keys belong to `src/main/remotes.ts`; account UI to Settings.
- Never expose tokens, device codes or token-bearing URLs in logs or errors. The device-flow UI displays its code
  only as required for the human's sign-in.
- Unit tests use fake fetch; `test/e2e/github.spec.ts` uses `KULISA_GITHUB`, never real GitHub.
