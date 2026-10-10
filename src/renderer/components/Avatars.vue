<script setup lang="ts">
// The profiles' pictures to choose from (main/avatars.js), as Chrome's avatar grid, the chosen one lit
// (components.css, .choices): Reka's ToggleGroup, one of them always chosen; the arrows move between them.
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import { avatarSrc } from '../lib/common';

defineProps<{ current: string }>();
const emit = defineEmits<{ choose: [avatar: string] }>();
</script>

<template>
  <ToggleGroupRoot class="pics choices" type="single" aria-label="Picture" :model-value="current"
    @update:model-value="(a) => a && emit('choose', String(a))">
    <ToggleGroupItem v-for="a in kulisa.avatars" :key="a" :value="a" class="icon small" :title="a" :aria-label="a" :data-avatar="a"><img class="avatar" alt="" :src="avatarSrc(a)"></ToggleGroupItem>
  </ToggleGroupRoot>
</template>
