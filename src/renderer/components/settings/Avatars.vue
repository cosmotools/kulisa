<script setup lang="ts">
// The profiles' pictures to choose from (shared/avatars.ts; docs/profiles.md), one always chosen.
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { avatarSrc } from '../../lib/common';
import { AVATARS } from '../../../shared/avatars';

defineProps<{ current: string }>();
const emit = defineEmits<{ choose: [avatar: string] }>();
</script>

<template>
  <ToggleGroup class="flex-wrap" type="single" size="sm" aria-label="Picture" :model-value="current" @update:model-value="(a) => a && emit('choose', String(a))">
    <ToggleGroupItem v-for="a in AVATARS" :key="a" :value="a" :title="a" :aria-label="a" :data-avatar="a"><img class="size-5" alt="" :src="avatarSrc(a)"></ToggleGroupItem>
  </ToggleGroup>
</template>
