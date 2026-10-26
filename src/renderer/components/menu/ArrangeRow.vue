<script setup lang="ts">
// ☰'s ready-made arrangements of the panels (lib/grid.ts, presets), each a picture of itself, as Windows' snap layouts.
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { applyPreset } from '../../lib/grid';

// The pictures' parts by their data-shape; the pages lit with their row
const PICTURE = 'size-16 max-h-11 stroke-border *:data-[shape=page]:fill-muted *:data-[shape=tab]:fill-muted *:data-[shape=term]:fill-background *:data-[shape=prompt]:fill-none *:data-[shape=prompt]:stroke-muted-foreground *:data-off:fill-border group-focus/dropdown-menu-item:*:data-[shape=page]:fill-muted-foreground/40';
</script>

<template>
  <div class="flex gap-1 px-1 pb-1" data-testid="arrange-row">
    <DropdownMenuItem class="flex-1 flex-col gap-1.5 py-2 text-muted-foreground" data-preset="columns" text-value="Columns" title="Profiles in columns, terminal below" @select="applyPreset('columns')"><svg :class="PICTURE" viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="page" x="1" y="1" width="14.67" height="19" rx="2" /><rect data-shape="page" x="16.67" y="1" width="14.67" height="19" rx="2" />
      <rect data-shape="page" x="32.33" y="1" width="14.67" height="19" rx="2" /><rect data-shape="term" x="1" y="21.5" width="46" height="9.5" rx="2" /><path data-shape="prompt" d="M4 24l2.5 2-2.5 2M8 28.5h3.5" /></svg>
      <span>Columns</span></DropdownMenuItem>
    <DropdownMenuItem class="flex-1 flex-col gap-1.5 py-2 text-muted-foreground" data-preset="grid" text-value="Two by two" title="Profiles two by two, terminal right" @select="applyPreset('grid')"><svg :class="PICTURE" viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="page" x="1" y="1" width="15" height="14.25" rx="2" /><rect data-shape="page" x="17.5" y="1" width="15" height="14.25" rx="2" />
      <rect data-shape="page" x="1" y="16.75" width="15" height="14.25" rx="2" /><rect data-shape="page" x="17.5" y="16.75" width="15" height="14.25" rx="2" />
      <rect data-shape="term" x="34" y="1" width="13" height="30" rx="2" /><path data-shape="prompt" d="M37 3.5l2.5 2-2.5 2M41 8h3.5" /></svg>
      <span>Two by two</span></DropdownMenuItem>
    <DropdownMenuItem class="flex-1 flex-col gap-1.5 py-2 text-muted-foreground" data-preset="focus" text-value="One at a time" title="One profile at a time (the others as tabs), terminal below" @select="applyPreset('focus')"><svg :class="PICTURE" viewBox="0 0 48 32" aria-hidden="true">
      <rect data-shape="tab" x="1" y="1" width="10" height="3" rx="1" /><rect data-shape="tab" data-off x="12" y="1" width="10" height="3" rx="1" />
      <rect data-shape="page" x="1" y="5" width="46" height="15" rx="2" /><rect data-shape="term" x="1" y="21.5" width="46" height="9.5" rx="2" /><path data-shape="prompt" d="M4 24l2.5 2-2.5 2M8 28.5h3.5" /></svg>
      <span>One at a time</span></DropdownMenuItem>
  </div>
</template>
