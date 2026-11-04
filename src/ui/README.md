# shadcn/ui

CLI-generated Radix window controls. `components.json` owns registry/preset configuration. The Kulisa package exports
through `index.ts` and imports no Kulisa code. Caller/theme rules: [ui.md](../../docs/ui.md#shadcn-in-kulisa); boundaries:
[packages.md](../../docs/packages.md).

## Generation

Hand-written files are `index.ts`, `tsconfig.json`, this README and agent instructions. Components, hooks, helpers
and `theme.css` are generated: do not edit them by hand, including customization suggested by generic skill examples.
CI checks regeneration against the committed output.

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
