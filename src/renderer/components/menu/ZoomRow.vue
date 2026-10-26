<script setup lang="ts">
// ☰'s zoom row, as in Chrome's menu: Zoom  −  100%  +. − and + are items of the menu that leave it open.
import { DropdownMenuItem } from 'reka-ui';
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
</script>

<template>
  <div class="zoomrow" data-testid="zoom-row">
    <Icon name="i-zoom" /><span>Zoom</span>
    <DropdownMenuItem class="out" title="Zoom out (Ctrl −)" aria-label="Zoom out" text-value="Zoom out" @select.prevent="kulisa.invoke('zoom:ui', -1)">−</DropdownMenuItem>
    <output>{{ Math.round(store.zoom * 100) }}%</output>
    <DropdownMenuItem class="in" title="Zoom in (Ctrl +)" aria-label="Zoom in" text-value="Zoom in" @select.prevent="kulisa.invoke('zoom:ui', 1)">+</DropdownMenuItem>
  </div>
</template>

<style>
.menu .zoomrow { display: flex; align-items: center; gap: 2px;
  span { flex: 1; }
  output { min-width: 4em; text-align: center; }
  [role="menuitem"] { display: grid; place-items: center; width: var(--control); height: var(--control); font-size: 1.15em; } }
</style>
