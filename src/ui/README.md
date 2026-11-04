# shadcn/ui

CLI-generated window components: `radix-nova`, Radix, Lucide, Geist, neutral base color. The Kulisa package exports
through `index.ts` and imports no Kulisa code. Usage: [ui.md](../../docs/ui.md); boundaries:
[packages.md](../../docs/packages.md).

Generated-source ownership and generation commands: [AGENTS.md](AGENTS.md#generation).

## The code

| Where | Responsibility |
|---|---|
| `index.ts`, `tsconfig.json` | Public exports and window type configuration |
| `components/ui/` | Generated components |
| `hooks/`, `lib/` | Shared helpers; `cn` re-export |
| `theme.css` | Tailwind, base styles, light/dark variables (`.dark` on root) |
