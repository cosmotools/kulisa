<script setup lang="ts">
// Over the grid while no profile is open and a terminal is (docs/window.md, The grid): the profiles' room folded to a
// row of buttons that open them, where the first one opens (above the terminal). With no terminal either, they are the
// launchers' second row (Terminals.vue). More than fit scroll, as a strip of tabs (lib/strip.ts): they were cut off.
import { computed, ref } from 'vue';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
  <nav v-if="shown" id="closedprofiles" ref="row" class="no-scrollbar flex shrink-0 scroll-fade-x scroll-px-10 gap-2 overflow-x-auto border-b p-2" aria-label="Open a profile">
    <Button v-for="p in profileLaunchers()" :key="p.id" variant="outline" :data-profile="p.id" :aria-label="p.name" :title="p.title" @click="p.run()">
      <Avatar v-if="p.avatar" size="sm"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar>
      <!-- A long name cut with …, so that it does not crowd out the rest -->
      <span class="max-w-48 truncate">{{ p.name }}</span><PlusIcon />
    </Button>
  </nav>
</template>
