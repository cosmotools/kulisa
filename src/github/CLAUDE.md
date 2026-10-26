# GitHub: working in this folder

The GitHub accounts and their sign-ins: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and
why: `README.md`. The spec and what is decided: issue #48.

- From outside only through `main/index.ts` (the main process) and `ipc.ts` (its channels, its types, GitHub's pages);
  it has no window half. `main/` uses nothing of `src/main` but `ipc.ts`, `log.ts` and `store.ts` (`newId`,
  `writeFileAtomic`); `npm run deps` refuses any other import.
- It knows nothing of projects, tasks or the window: which projects use an account, deleting one (`deleteGitHub` in
  `projects.ts`: its question, its projects) and opening a page come from the caller (`installGitHub`, `app.ts`). The
  bindings of repositories to accounts are `projects.ts`'s; a remote's key is the base's (`src/main/remotes.ts`); the
  pages are the settings cluster's (`GitHubPage.vue`, `RepoAccount.vue`).
- Never a token, a code or an address with a token in the log, an error or the window.
- Its unit tests are here (`*.test.ts`, `npm run test:unit`, a fake fetch); its e2e tests in
  `test/e2e/github.spec.ts`, against the test site's fake GitHub (`KULISA_GITHUB`), never the real one.
