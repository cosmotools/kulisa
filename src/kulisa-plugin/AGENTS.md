# Kulisa plugin

A Kulisa package: read [packages.md](../../docs/packages.md) and [README.md](README.md), including Tool design.

- Entry: `main/index.ts`; runtime and type dependencies on core domain objects are forbidden. The allowed core
  infrastructure is listed in `.dependency-cruiser.ts`.
- Caller contracts: `main/core.ts`. Keep them in the Kulisa package's terms; the core implements them in
  `src/main/plugin.ts`. Ownership, checks and questions stay with core actions.
- Every agent gets the same tools and shared skill (`resources/skills/kulisa/SKILL.md`); keep the skill in step with
  tools and rules. CLI-specific behavior and transcript readers belong to that CLI's `main/agents/<name>.ts`.
- Agent resources stay in `resources/`; shared instructions contain no CLI-specific assumptions.
- Unit tests: `*.test.ts`; end-to-end tests and outside callers: README, The code.
