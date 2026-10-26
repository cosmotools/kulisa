<script setup lang="ts">
// A screenshot's thumbnail as its window draws it (../README.md, The thumbnail): its own view is above the pages and
// hides with them; this shows while they are pictures (under a menu or a dialog, its own menu among them).
import { shallowRef } from 'vue';
import type { ThumbnailEvents } from '../ipc.ts';

// Where the window draws it, while it is shown.
const thumbnail = shallowRef<ThumbnailEvents['thumbnail:place']>(null);
kulisa.on('thumbnail:place', (t) => { thumbnail.value = t; });
</script>

<template>
  <img v-if="thumbnail" id="shotthumb" :src="thumbnail.src" alt="" :style="{ left: `${thumbnail.x}px`, top: `${thumbnail.y}px`, width: `${thumbnail.width}px`, height: `${thumbnail.height}px` }">
</template>

<style>
/* Over the pages' pictures, under the window's dialogs and menus (their z-index: 20, 30). */
#shotthumb { position: fixed; z-index: 10; object-fit: cover; object-position: top; border-radius: var(--corner); pointer-events: none;
  outline: 1px solid var(--shot-edge); outline-offset: -1px; box-shadow: 0 0 0 1px var(--shot-ring), 0 3px 10px var(--shot-shadow); } /* as its own page's (thumbnail.ts) */
</style>
