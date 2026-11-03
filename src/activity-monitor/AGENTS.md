# Activity monitor

Read `README.md` and `docs/packages.md`. Planned work: #113.

- Entry: `main/index.ts`; no renderer or channels. Imports from `src/main` are forbidden.
- Measure only caller-supplied tasks (`Tasks`, from `app.ts`), including unloaded tasks.
- Presentation and deletion belong to callers: `Task.artifactsUsage`, `Task.deleteArtifacts`, Resources and
  `task_artifacts`.
- Tests: `monitor.test.ts`; integration: `test/e2e/agent-reports.spec.ts`.
