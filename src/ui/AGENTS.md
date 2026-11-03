# shadcn/ui

Read `README.md`, `docs/ui.md` and `docs/packages.md`.

- Hand-edit only `index.ts`, `tsconfig.json`, README and agent instructions. `npm run ui` regenerates everything else;
  CI rejects differences. Add components with `npm run ui -- <name>`, then export them from `index.ts`.
- Entry: `index.ts` (`@ui`); no imports from other `src/` parts.
- Put Kulisa's theme variables in `src/renderer/window.css`. Component callers pass only layout and size classes
  (`kulisa/ui-as-shipped`).
