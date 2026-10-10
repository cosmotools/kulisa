<script setup lang="ts">
// The profiles' pictures to choose from (main/avatars.js), as Chrome's avatar grid, the chosen one lit
// (components.css, .choices).
import { avatarSrc } from '../lib/common';

defineProps<{ current: string }>();
const emit = defineEmits<{ choose: [avatar: string] }>();
</script>

<template>
  <div class="pics choices" role="group" aria-label="Picture">
    <button v-for="a in kulisa.avatars" :key="a" type="button" class="icon small" :title="a" :aria-label="a" :data-avatar="a"
      :aria-pressed="a === current" @click="emit('choose', a)"><img class="avatar" alt="" :src="avatarSrc(a)"></button>
  </div>
</template>
