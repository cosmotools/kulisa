<script setup lang="ts">
// ☰'s zoom row, as in Chrome's menu: Zoom  −  100%  +. It stays open while − and + are clicked.
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
</script>

<template>
  <div class="zoomrow">
    <Icon name="i-zoom" /><span>Zoom</span>
    <button class="out" title="Zoom out (Ctrl −)" @click="kulisa.invoke('zoom:ui', -1)">−</button>
    <output>{{ Math.round(store.zoom * 100) }}%</output>
    <button class="in" title="Zoom in (Ctrl +)" @click="kulisa.invoke('zoom:ui', 1)">+</button>
  </div>
</template>

<style>
#menu .zoomrow { display: flex; align-items: center; gap: 2px;
  span { flex: 1; }
  output { min-width: 4em; text-align: center; }
  button { width: var(--control); padding: 0; font-size: 1.15em; } }
</style>
