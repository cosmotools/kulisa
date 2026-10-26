<script setup lang="ts">
// Over the grid while no profile is open and a terminal is (docs/window.md, The grid): the profiles' room folded to a
// row of buttons that open them, where the first one opens (above the terminal). With no terminal either, they are the
// launchers' second row (Terminals.vue). More than fit scroll, as a strip of tabs (lib/strip.ts): they were cut off.
import { computed, ref } from 'vue';
import { store } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { avatarSrc } from '../../lib/common';
import { useStrip } from '../../lib/strip';
import { PlusIcon } from '@lucide/vue';

const shown = computed(() => !!store.current && !store.profiles.length && store.terminals.list.length > 0);
const row = ref<HTMLElement>();
useStrip(row, () => null); // no button is the active one
</script>

<template>
  <nav v-if="shown" id="closedprofiles" ref="row" class="tabstrip" aria-label="Open a profile">
    <button v-for="p in profileLaunchers()" :key="p.id" class="opener" :data-profile="p.id" :aria-label="p.name" :title="p.title" @click="p.run()">
      <img v-if="p.avatar" class="avatar" :src="avatarSrc(p.avatar)" alt="">
      <span class="name">{{ p.name }}</span><PlusIcon />
    </button>
  </nav>
</template>

<style>
#closedprofiles { display: flex; gap: var(--gap); flex: none; margin-block-end: var(--gap); }
</style>
