# Screenshots: working in this folder

All of the screenshots: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and why:
`README.md`.

- From outside only through `main/index.ts`, `renderer/index.ts` and `ipc.ts`. `main/` uses nothing of `src/main` but
  `ipc.ts` and `log.ts`; `npm run deps` refuses any other import. The caller passes what it needs (a Playwright
  page, who takes it, the profile's name for a file).
- It knows nothing of profiles, tasks or agents: they use it. The checks of a tab (the sign-in pause, a dialog, an
  empty tab) are the core's, `Profile.screenshot`; the agent's tool is in the Kulisa plugin (`tools/browser.ts`); the
  human's ⋮ and key are the window's, choosing an element is Pick's (`picker.ts`). The thumbnail is all here; the
  window only makes it, says where its panes are and when its pages are covered, and gives it a menu and the agent's
  prompt (`window.ts`, `components/App.tsx`).
- Its unit tests are here (`folder.test.ts`); its e2e tests in `test/e2e/` (README, The code).
