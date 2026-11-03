# shadcn/ui

CLI-generated window components: `radix-nova`, Radix, Lucide, Geist, neutral base color. The Kulisa package exports
through `index.ts` and imports no Kulisa code. Usage: [ui.md](../../docs/ui.md); boundaries:
[packages.md](../../docs/packages.md).

- Never hand-edit generated components, hooks, helpers or `theme.css`. `npm run ui` regenerates them; CI checks the
  result. Settings are in root `components.json`.
- `npm run ui -- <name>` adds a registry component; export it by name from `index.ts`.
- `npm run ui` regenerates all components after a pinned `shadcn` or registry update. `scripts/ui.ts` adds them in
  deterministic order and installs their dependencies as devDependencies.

## The code

| Where | Responsibility |
|---|---|
| `index.ts`, `tsconfig.json` | Public exports and window type configuration |
| `components/ui/` | Generated components |
| `hooks/`, `lib/` | Shared helpers; `cn` re-export |
| `theme.css` | Tailwind, base styles, light/dark variables (`.dark` on root) |
