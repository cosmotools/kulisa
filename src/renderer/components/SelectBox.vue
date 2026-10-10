<script setup lang="ts">
// A field to choose one of a few (docs/ui.md, Controls): Reka's Select in the window's look, a button showing the
// chosen one; its list a menu's (.menu, rows .item, the chosen one checked). Over a dialog, as it is used.
//   <SelectBox id v-model :options="[{ value, label }]" />   value '' is a choice too (Reka's items need another)
import { computed } from 'vue';
import { SelectContent, SelectIcon, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue,
  SelectViewport } from 'reka-ui';
import Icon from './Icon.vue';

defineOptions({ inheritAttrs: false }); // aria-label and the like are the button's
const props = defineProps<{ id: string; options: { value: string; label: string }[] }>();
const model = defineModel<string>({ required: true });
const NONE = '\u0000none'; // Reka's items take no empty value
const value = computed({ get: () => model.value || NONE, set: (v: string) => { model.value = v === NONE ? '' : v; } });
const items = computed(() => props.options.map((o) => ({ ...o, value: o.value || NONE })));
</script>

<template>
  <SelectRoot v-model="value">
    <SelectTrigger :id class="select" :data-value="model" v-bind="$attrs"><SelectValue /><SelectIcon as-child><Icon name="i-down" /></SelectIcon></SelectTrigger>
    <SelectPortal>
      <SelectContent class="menu ready" position="popper" :side-offset="4" :collision-padding="4">
        <SelectViewport>
          <SelectItem v-for="o in items" :key="o.value" :value="o.value" class="item" :data-value="o.value === NONE ? '' : o.value">
            <span class="text"><SelectItemText class="label">{{ o.label }}</SelectItemText></span>
            <SelectItemIndicator as-child><Icon class="check" name="i-done" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
