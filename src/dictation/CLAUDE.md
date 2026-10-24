# Dictation: working in this folder

All of the dictation is here: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and why:
`README.md`; keep it current with the code, as the docs in `docs/`. The plan and what is decided: issue #120.

- From outside only through `main/index.ts`, `renderer/index.ts` and `ipc.ts`. `main/` uses nothing of `src/main` but
  `ipc.ts`; `renderer/` nothing of the window; `npm run deps` refuses any other import.
- It knows nothing of tasks, agents or the window: they tell it facts (the agent in front, the key, a task gone) and
  draw what it sends. Which agent the key speaks to is the task's (`Task.holdKey`); the key and how it is changed are
  the window's (`keys.ts`, `shortcuts.ts`); what an agent's own dictation is (its key, its settings) is its entry's in
  `src/main/agents/`.
- Its e2e test is in `test/window.ts` (README, The code).
