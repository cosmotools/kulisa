<script setup lang="ts">
// An icon of the sprite (Sprite.vue; docs/ui.md, Icons): its lines in the text's color, its size the place's.
defineProps<{ name: string }>();
</script>

<template>
  <svg aria-hidden="true"><use :href="`#${name}`" /></svg>
</template>
