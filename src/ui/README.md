# shadcn/ui

The window's components: [shadcn/ui](https://ui.shadcn.com) (style `radix-nova`: Radix primitives, Lucide icons,
Geist; base color `neutral`) as its CLI writes them into this folder, and its theme (`theme.css`). A Kulisa package
([packages.md](../../docs/packages.md)) of the window alone: it knows nothing of Kulisa; the window uses it through
`index.ts`. How the window uses it: [ui.md](../../docs/ui.md).

**Never edited by hand.** What the CLI writes (`components/`, `hooks/`, `lib/`, `theme.css`; `components.json` at the
repository's root its settings) is made again by `npm run ui`, and the CI refuses a difference (`checks (ubuntu-latest)`):
a fix or a look of our own would be lost at the next update, and a component keeps its keyboard, focus and
accessibility as shadcn and Radix maintain them.

- `npm run ui -- <name>` adds one of shadcn's components (its registry's name: `dropdown-menu`); its export goes into
  `index.ts` by name. The CLI's own dependencies of it are installed as devDependencies (`scripts/ui.ts`).
- `npm run ui` makes all of it again: after an update of `shadcn` (pinned, `package.json`) or of its registry, which the
  CI's check also shows as a difference.
- The CLI writes a file differently as it comes first or as another's dependency (`"use client"`): `scripts/ui.ts` adds
  them in one order, so its output is the same each time.

## The code

| Where | What |
|---|---|
| `index.ts` | the entry: the components the window uses, by name (Kulisa's; `tsconfig.json` too, the window's) |
| `components/ui/` | the components, a file each, as the CLI writes them |
| `hooks/`, `lib/` | what they share (`cn`, re-exported from the `cn` package) |
| `theme.css` | Tailwind, shadcn's base styles and the theme's variables, dark (`.dark` on the root) and light |
