# shadcn/ui: working in this folder

The window's components as shadcn's CLI writes them: a Kulisa package (`docs/packages.md`); how and why: `README.md`;
how the window uses them: `docs/ui.md`.

- **Nothing here is edited by hand** but `index.ts`, `tsconfig.json`, `README.md`, `CLAUDE.md` and this file: `npm run ui` makes it again, the CI
  refuses a difference. A new component: `npm run ui -- <name>`, then its export in `index.ts`.
- From outside only through `index.ts` (`@ui`); it imports nothing of `src/`. `npm run deps` refuses any other import.
- A look of Kulisa's is the theme's variables, outside (`src/renderer/window.css`); on a component in the window only
  layout and size classes (`npm run lint`, `kulisa/ui-as-shipped`).
