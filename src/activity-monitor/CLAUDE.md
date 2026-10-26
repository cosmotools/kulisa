# Activity monitor: working in this folder

What Kulisa takes on the computer: a Kulisa package (`docs/packages.md`: what one is, its rules). How it works and
why: `README.md`; keep it current with the code, as the docs in `docs/`. What is planned for it: issue #113.

- From outside only through `main/index.ts`; it has no window half and no channels. `main/` uses nothing of
  `src/main`; `npm run deps` refuses any import.
- It knows of tasks only what the caller gives it (`Tasks`: `app.ts`, from the store). What a figure means to the
  human or the agent, and deleting, are the callers': `Task.artifactsUsage`, `Task.deleteArtifacts`, the Resources
  island, `task_artifacts`.
- Its unit tests are here (`monitor.test.ts`, `npm run test:unit`); its e2e test in `test/e2e/agent-reports.spec.ts`.
