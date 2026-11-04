# shadcn/ui

Read [README.md](README.md), [UI integration](../../docs/ui.md#shadcn-in-kulisa) and
[package boundaries](../../docs/packages.md).

- Hand-edit only `index.ts`, `tsconfig.json`, README and agent instructions. `npm run ui` regenerates everything else;
  CI rejects differences. Add components with `npm run ui -- <name>`, then export them from `index.ts`.
- Entry: `index.ts` (`@ui`); no imports from other `src/` parts.
