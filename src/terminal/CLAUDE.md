# The terminal: working in this folder

All of the terminal is here: a Kulisa package (`docs/packages.md`: what one is, its rules, moving code into one).
How it works and why: `README.md`; keep it current with the code, as the docs in `docs/`.

- From outside only through `main/index.ts` (the main process), `renderer/index.ts` (the window) and `ipc.ts` (its
  channels). `main/` uses nothing of `src/main` but `ipc.ts` and `log.ts`; `renderer/` nothing of the window. `npm run
  deps` refuses any other import: what the package needs from outside comes in through its API, passed by the caller.
- It knows nothing of tasks, agents or profiles: they use it (`tasks.ts`; the island, `Terminals.vue`). A rule about
  an agent belongs there, not here.
- Its unit tests are here (`*.test.ts`, run by `npm run test:unit`); its e2e tests in `test/` (README, The code).
