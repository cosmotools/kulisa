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
  <!-- Over the pages' pictures, under the window's dialogs and menus; framed as its own page's (thumbnail.ts) -->
  <img v-if="thumbnail" id="shotthumb" class="pointer-events-none fixed z-10 rounded-sm object-cover object-top shadow-[0_0_0_1px_#00000030,0_3px_10px_#00000060] outline -outline-offset-1
    outline-white/50" :src="thumbnail.src" alt=""
    :style="{ left: `${thumbnail.x}px`, top: `${thumbnail.y}px`, width: `${thumbnail.width}px`, height: `${thumbnail.height}px` }">
</template>
