# shadcn/ui

Read [README.md](README.md), [UI integration](../../docs/ui.md#shadcn-in-kulisa) and
[package boundaries](../../docs/packages.md).

- Entry: `index.ts` (`@ui`); no imports from other `src/` parts.

## Generation

- Hand-edit only `index.ts`, `tsconfig.json`, README and agent instructions. Components, hooks, helpers and
  `theme.css` are generated; CI checks regeneration against the committed output.
- Add a registry component with `npm run ui -- <name>`, then export it by name from `index.ts`.
- Regenerate all components with `npm run ui` after a pinned `shadcn` or registry update. `scripts/ui.ts` adds them
  in deterministic order and installs their dependencies as devDependencies. Configuration lives in root `components.json`.
