<script setup lang="ts">
// A row of ☰ with its few choices, the chosen one lit (it stays open, so another can be tried): Theme  Dark  Light
// System, Projects bar  Top  Bottom. kind: the data attribute each button has (data-theme, data-bar).
import Icon from '../Icon.vue';

defineProps<{ kind: string; icon: string; label: string; choices: { value: string; label: string; title?: string }[]; chosen: string }>();
const emit = defineEmits<{ choose: [value: string] }>();
</script>

<template>
  <div :class="`${kind}row`">
    <Icon :name="icon" /><span>{{ label }}</span>
    <button v-for="c in choices" :key="c.value" v-bind="{ [`data-${kind}`]: c.value }" :title="c.title" :aria-pressed="c.value === chosen"
      @click="emit('choose', c.value)">{{ c.label }}</button>
  </div>
</template>

<style>
#menu :is(.themerow, .barrow) { display: flex; align-items: center; gap: 2px;
  span { flex: 1; margin-inline-end: 12px; }
  button { padding: 0 8px; color: var(--text-dim); &[aria-pressed="true"] { background: var(--island-hi); color: var(--text-strong); } } }
</style>
