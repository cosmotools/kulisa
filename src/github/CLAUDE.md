# GitHub: working in this folder

All of the GitHub accounts is here: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and why:
`README.md`; the decisions behind it: issue #48. Keep the README current with the code, as the docs in `docs/`.

- From outside only through `main/index.ts` and `ipc.ts`. `main/` uses nothing of `src/main` but `ipc.ts` and
  `log.ts`; `npm run deps` refuses any other import: what it needs comes in through `Github`'s options (the keyring,
  the projects using an account, asking the human, an account deleted).
- It knows nothing of projects, tasks or the window. The agent's GitHub tools are registered in the Kulisa plugin
  (`mcp-server.ts`), which passes the project's repositories in; the rule of where they write is here (`Github.call`).
- A repository's chosen account is the project's (`projects.ts`);
  Settings → GitHub is the window's (`settings/GithubPage.vue`).
- **A token is never shown, sent to the window, logged or written in the clear** (CLAUDE.md, Rules). A channel that takes
  one names its argument `token`, which the log's `summary` leaves out.
- Its unit tests are `github.test.ts` (GitHub answered by a fake `fetch`); its e2e test is in `test/tasks.ts`, against
  the tests' fake GitHub (`test/fixtures/site.ts`, `/github/`; `KULISA_GITHUB`).
