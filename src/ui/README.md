# shadcn/ui

CLI-generated Radix window controls. `components.json` owns registry/preset configuration. The Kulisa package exports
through `index.ts` and imports no Kulisa code. Caller/theme rules: [ui.md](../../docs/ui.md#shadcn-in-kulisa); boundaries:
[packages.md](../../docs/packages.md).

Generated-source ownership and generation commands: [AGENTS.md](AGENTS.md#generation).

## The code

| Where | Responsibility |
|---|---|
| `index.ts`, `tsconfig.json` | Public exports and window type configuration |
| `components/ui/` | Generated components |
| `hooks/`, `lib/` | Shared helpers; `cn` re-export |
| `theme.css` | Tailwind, base styles, light/dark variables (`.dark` on root) |
