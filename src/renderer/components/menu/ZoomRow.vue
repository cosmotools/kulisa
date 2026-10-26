<script setup lang="ts">
// ☰'s zoom row, as in Chrome's menu: Zoom  −  100%  +. − and + are items of the menu that leave it open.
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { store } from '../../lib/store';
import { MinusIcon, PlusIcon, ZoomInIcon } from '@lucide/vue';
</script>

<template>
  <div class="flex items-center gap-1.5 px-1.5 text-sm" data-testid="zoom-row">
    <ZoomInIcon /><span class="flex-1">Zoom</span>
    <DropdownMenuItem class="size-7 justify-center p-0" title="Zoom out (Ctrl −)" aria-label="Zoom out" text-value="Zoom out" @select.prevent="kulisa.invoke('zoom:ui', -1)"><MinusIcon /></DropdownMenuItem>
    <output class="min-w-12 text-center tabular-nums">{{ Math.round(store.zoom * 100) }}%</output>
    <DropdownMenuItem class="size-7 justify-center p-0" title="Zoom in (Ctrl +)" aria-label="Zoom in" text-value="Zoom in" @select.prevent="kulisa.invoke('zoom:ui', 1)"><PlusIcon /></DropdownMenuItem>
  </div>
</template>
