# Screenshots: working in this folder

All of the screenshots is here: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and why:
`README.md`; keep it current with the code, as the docs in `docs/`.

- From outside only through `main/index.ts`, `renderer/index.ts` and `ipc.ts`. `main/` uses nothing of `src/main` but
  `ipc.ts` and `log.ts`; `npm run deps` refuses any other
  import: what the package needs comes in through its API, passed by the caller (a Playwright page, who takes it,
  the profile's name for a file).
- It knows nothing of profiles, tasks or agents: they use it. The checks of a tab (the sign-in pause, a dialog, an
  empty tab) are the core's, `Profile.screenshot`; the agent's tool is in the Kulisa plugin (`tools/browser.ts`); the
  human's ⋮ and key are the window's, choosing an element is Pick's (`picker.ts`). The thumbnail is all here; the
  window only makes it, says where its panes are and when its pages are covered, and gives it a menu and the agent's
  prompt (`window.ts`, `App.vue`).
- Its e2e tests are in `test/` (README, The code).
