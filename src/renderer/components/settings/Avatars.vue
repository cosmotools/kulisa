<script setup lang="ts">
// The profiles' pictures to choose from (shared/avatars.ts; docs/profiles.md): Reka's ToggleGroup, one always chosen.
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';

defineProps<{ current: string }>();
const emit = defineEmits<{ choose: [avatar: string] }>();
</script>

<template>
  <ToggleGroupRoot class="pics choices" type="single" aria-label="Picture" :model-value="current"
    @update:model-value="(a) => a && emit('choose', String(a))">
    <ToggleGroupItem v-for="a in AVATARS" :key="a" :value="a" class="icon small" :title="a" :aria-label="a" :data-avatar="a"><img class="avatar" alt="" :src="avatarSrc(a)"></ToggleGroupItem>
  </ToggleGroupRoot>
</template>
