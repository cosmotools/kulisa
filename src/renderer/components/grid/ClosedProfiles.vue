<script setup lang="ts">
// Over the grid while no profile is open and a terminal is (docs/window.md, The grid): the profiles' room folded to a
// row of tiles that open them, where the first one opens (above the terminal). With no terminal either, they are the
// launchers' second row (Terminals.vue).
import { computed } from 'vue';
import Icon from '../Icon.vue';
import { store } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { avatarSrc } from '../../lib/common';

const shown = computed(() => !!store.current && !store.profiles.length && store.terminals.list.length > 0);
</script>

<template>
  <nav v-if="shown" id="closedprofiles" aria-label="Open a profile">
    <button v-for="p in profileLaunchers()" :key="p.id" class="launcher small" :data-profile="p.id" :title="p.title" @click="p.run()">
      <img v-if="p.avatar" class="avatar" :src="avatarSrc(p.avatar)" alt=""><Icon v-else name="i-plus" />
      <span class="name">{{ p.name }}</span><small v-if="p.sub">{{ p.sub }}</small>
    </button>
  </nav>
</template>

<style>
#closedprofiles { display: flex; gap: var(--gap); flex: none; overflow: hidden; margin-block-end: var(--gap); .launcher { flex: none; } }
</style>
