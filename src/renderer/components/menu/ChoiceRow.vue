<script setup lang="ts">
// A row of ☰ with its few choices side by side (docs/ui.md, Menus): it stays open, so another can be tried. kind: the
// data attribute each has (data-theme, data-bar). The choices as shadcn-vue's Tabs show theirs: no menu part does.
import type { Component } from 'vue';
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from 'reka-ui';

defineProps<{ kind: string; icon: Component; label: string; choices: { value: string; label: string; title?: string }[]; chosen: () => string;
  choose: (value: string) => unknown }>();
</script>

<template>
  <DropdownMenuRadioGroup class="flex items-center gap-1.5 px-1.5 py-0.5 text-sm" :data-testid="`${kind}-row`" :model-value="chosen()" @update:model-value="(v) => choose(String(v))">
    <component :is="icon" /><span class="flex-1 pe-3">{{ label }}</span>
    <div class="flex rounded-lg bg-muted p-0.5">
      <DropdownMenuRadioItem v-for="c in choices" :key="c.value" :value="c.value" v-bind="{ [`data-${kind}`]: c.value }" :title="c.title"
        class="flex h-6 cursor-default items-center rounded-md px-2 text-muted-foreground outline-hidden select-none focus:text-foreground data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm dark:data-[state=checked]:bg-input/30"
        @select.prevent>{{ c.label }}</DropdownMenuRadioItem>
    </div>
  </DropdownMenuRadioGroup>
</template>
