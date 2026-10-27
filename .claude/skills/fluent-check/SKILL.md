---
name: fluent-check
description: Check a part of Kulisa's window (a component, a cluster like components/settings/, or a diff) against stock Fluent UI v9 as docs/ui.md asks, and list where it draws its own instead. Use after building or changing UI in src/renderer, before showing it to the author, or when the author asks whether something is "stock Fluent".
---

# Checking UI against Fluent

The rules are `docs/ui.md`'s (its top, "Fluent in Kulisa", "Own drawing"); read them first. This is how to find what
breaks them. Lint (`npm run lint`) catches raw elements, hex colors and `var(--color…)` strings; what follows is what
it cannot.

## 1. What its styles set

Print every `makeStyles` block of the files (`awk '/makeStyles\(\{/,/^\}\);/' <file>`). Each property is one of:

- placing or sizing a component (flex, grid, gap, width, margin between components, overflow): fine;
- drawing (color, background, border, radius, a component's padding, font, shadow): own drawing. Allowed only if
  `docs/ui.md`'s "Own drawing" names it, with its reason; otherwise it is a finding.
- a Fluent token remapped (`'--colorNeutral…': tokens.…`): theming. Fine when its comment says why, and `docs/ui.md`
  says where.

Follow the shared parts it uses (`Group`, `List`, `ErrorBar`, `SignIn`, the menus' files): their styles count too.

## 2. What it renders

- Raw `div`/`span`: only for layout around components. A raw element that shows something (a box, a line, a label)
  has a Fluent component for it, or is own drawing.
- `style={…}`: only what run time knows (`docs/ui.md`).
- A Fluent component used against its meaning: an interactive one that does nothing (a `BreadcrumbButton`, a `Link`
  or `Button` without an action), a typography prop overridden to match something else, a slot filled with a
  composition Fluent has no slot for. Read its `.d.ts` and its storybook page (`docs/ui.md`, top) for what it is meant
  for and whether a variant does it (`BreadcrumbItem` text, `Card` for a framed box, `appearance`, `size`).

## 3. Report

For each finding: the file and line, what it draws, the Fluent component or pattern that does it, and a
recommendation (replace, or keep and name it in "Own drawing" with its reason). Say what was checked and found to be
stock, in a line, not a list. Fix only what the author agrees to; a finding kept goes into `docs/ui.md`.
