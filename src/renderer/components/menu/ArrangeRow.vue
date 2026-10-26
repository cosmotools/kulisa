<script setup lang="ts">
// ☰'s ready-made arrangements of the panels (lib/grid.ts, presets), each a picture of itself, as Windows' snap layouts.
import { DropdownMenuItem } from 'reka-ui';
import { applyPreset } from '../../lib/grid';
</script>

<template>
  <div class="arrange" data-testid="arrange-row">
    <DropdownMenuItem data-preset="columns" text-value="Columns" title="Profiles in columns, terminal below" @select="applyPreset('columns')"><svg viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="page" x="1" y="1" width="14.67" height="19" rx="2" /><rect data-shape="page" x="16.67" y="1" width="14.67" height="19" rx="2" />
      <rect data-shape="page" x="32.33" y="1" width="14.67" height="19" rx="2" /><rect data-shape="term" x="1" y="21.5" width="46" height="9.5" rx="2" /><path data-shape="prompt" d="M4 24l2.5 2-2.5 2M8 28.5h3.5" /></svg>
      <span>Columns</span></DropdownMenuItem>
    <DropdownMenuItem data-preset="grid" text-value="Two by two" title="Profiles two by two, terminal right" @select="applyPreset('grid')"><svg viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="page" x="1" y="1" width="15" height="14.25" rx="2" /><rect data-shape="page" x="17.5" y="1" width="15" height="14.25" rx="2" />
      <rect data-shape="page" x="1" y="16.75" width="15" height="14.25" rx="2" /><rect data-shape="page" x="17.5" y="16.75" width="15" height="14.25" rx="2" />
      <rect data-shape="term" x="34" y="1" width="13" height="30" rx="2" /><path data-shape="prompt" d="M37 3.5l2.5 2-2.5 2M41 8h3.5" /></svg>
      <span>Two by two</span></DropdownMenuItem>
    <DropdownMenuItem data-preset="focus" text-value="One at a time" title="One profile at a time (the others as tabs), terminal below" @select="applyPreset('focus')"><svg viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="tab" x="1" y="1" width="10" height="3" rx="1" /><rect data-shape="tab" data-off x="12" y="1" width="10" height="3" rx="1" />
      <rect data-shape="page" x="1" y="5" width="46" height="15" rx="2" /><rect data-shape="term" x="1" y="21.5" width="46" height="9.5" rx="2" /><path data-shape="prompt" d="M4 24l2.5 2-2.5 2M8 28.5h3.5" /></svg>
      <span>One at a time</span></DropdownMenuItem>
  </div>
</template>

<style>
.menu .arrange { display: flex; gap: 4px; padding: 2px 4px 6px;
  [role="menuitem"] { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: auto; padding: 8px 10px 6px;
    color: var(--text-dim); white-space: nowrap; &[data-highlighted] { color: var(--text-strong); } }
  svg { width: 64px; height: 43px; }
  [data-shape="page"], [data-shape="tab"] { fill: color-mix(in srgb, var(--page) 70%, transparent); stroke: var(--line); stroke-width: 1; } /* the edge: white on a light menu */
  [data-shape="tab"][data-off] { fill: var(--line); }
  [data-shape="term"] { fill: var(--window); stroke: var(--line); stroke-width: 1; }
  [data-shape="prompt"] { fill: none; stroke: var(--text-dim); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
  [data-highlighted] :is([data-shape="page"], [data-shape="tab"]:not([data-off])) { fill: var(--page); } }
</style>
