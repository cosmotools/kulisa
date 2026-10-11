<script setup lang="ts">
// A project's group panel, as Chrome's tab group's (ROADMAP, "Projects as Chrome's tab groups"): its label's
// right-click opens it at the label. At its top the project's name, color and icon, saved as they change (the name on
// Enter or leaving its field); under them its actions (ProjectBar.vue builds them, as a menu's items). Reka's Popover
// (a dialog's keyboard: Tab between its parts, Esc closes), not a menu: a menu takes the keys typed (its typeahead)
// and the focus under the pointer, so a name could not be typed there. The pages are pictures meanwhile, as under a
// menu, and it closes as one does (a press outside, Esc, an action, the window left).
import { computed, ref, shallowRef, watch } from 'vue';
import { ColorSwatchPickerItem, ColorSwatchPickerItemSwatch, ColorSwatchPickerRoot, PopoverContent, PopoverPortal, PopoverRoot,
  ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import Icon from './Icon.vue';
import { covered } from '../lib/views';
import { focusBack, type MenuItem, type MenuRow } from '../lib/menu';
import { iconTitle, projectIcon } from '../lib/common';
import { store } from '../lib/store';

const { open, ready } = covered('pictures');
const anchor = shallowRef<HTMLElement>(), nameField = ref<HTMLInputElement>();
const id = ref(''), items = shallowRef<MenuItem[]>([]), name = ref(''), error = ref('');
const choices = shallowRef<{ colors: string[]; icons: string[] }>({ colors: [], icons: [] });
const p = computed(() => store.projects.projects.find((x) => x.id === id.value));
const icons = computed(() => [...(p.value?.favicon ? ['favicon'] : []), ...choices.value.icons]);
let focused: Element | null = null;

async function openAt(project: string, at: HTMLElement, list: MenuItem[]) {
  if (!choices.value.colors.length) choices.value = await kulisa.invoke('project:new-defaults');
  if (!open.value) focused = document.activeElement;
  id.value = project; anchor.value = at; items.value = list;
  name.value = p.value?.name ?? ''; error.value = ''; sent = '';
  look = { name: p.value?.name, color: p.value?.color, icon: p.value?.icon || 'logo' };
  open.value = true;
}
defineExpose({ openAt });

// What it was given last, each change on top of the ones before (two clicks in a row: the second keeps the first's).
let look: { name?: string; color?: string; icon?: string } = {};
async function save(change: typeof look) {
  look = { ...look, ...change };
  const r = await kulisa.invoke<{ error?: string } | null>('project:settings', { id: id.value, ...look });
  error.value = r?.error || '';
  if (r?.error) look = { ...look, name: p.value?.name }; // a name refused: its color and icon still saved after
}
let sent = '';
function saveName() {
  const n = name.value.trim();
  if (n && n !== p.value?.name && n !== sent) { sent = n; save({ name: n }); }
}
// However it closes (Esc, a press outside): the name typed kept, as Chrome's. Its field taken out of the page while
// it has the keyboard sends no blur.
watch(open, (v) => { if (!v) saveName(); });
const isRow = (it: MenuItem): it is MenuRow => it !== '-' && 'label' in it;
// Closed first, its action on the next turn, as a menu's row: the action may take its window away (Move to Window).
function run(it: MenuRow) { open.value = false; setTimeout(() => it.run?.()); }
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverPortal>
      <PopoverContent class="menu grouppanel" :class="{ ready }" :reference="anchor" side="top" align="start" :side-offset="4" :collision-padding="4"
        :style="{ '--color': p?.color }" @open-auto-focus.prevent="nameField?.focus()" @close-auto-focus="focusBack($event, focused)">
        <div class="gphead">
          <input id="gpname" ref="nameField" v-model="name" data-name maxlength="64" spellcheck="false" aria-label="Project name"
            @input="error = ''" @blur="saveName" @keydown.enter.prevent="saveName(); open = false">
          <ColorSwatchPickerRoot id="gpcolors" class="choices" aria-label="Color" :model-value="p?.color" @update:model-value="(c) => c && save({ color: String(c) })">
            <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
          </ColorSwatchPickerRoot>
          <ToggleGroupRoot id="gpicons" class="choices" type="single" aria-label="Icon" :model-value="p?.icon || 'logo'" @update:model-value="(v) => v && save({ icon: String(v) })">
            <ToggleGroupItem v-for="v in icons" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="v === 'favicon'"
              :src="p?.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
          </ToggleGroupRoot>
          <p class="error">{{ error }}</p>
        </div>
        <template v-for="(it, i) in items" :key="i">
          <div v-if="it === '-'" role="separator" />
          <div v-else-if="'heading' in it" class="heading">{{ it.heading }}</div>
          <button v-else-if="isRow(it)" type="button" class="item" :disabled="it.enabled === false" :data-disabled="it.enabled === false ? '' : undefined" @click="run(it)">
            <span class="text"><span class="label">{{ it.label }}</span><small>{{ it.sub }}</small></span><kbd>{{ it.keys }}</kbd>
          </button>
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/* Its look is a menu's (.menu, rows .item); its top the project's own: a name field, its colors and icons */
.grouppanel { width: 300px;
  .gphead { display: grid; gap: var(--inset); padding: var(--inset); .error { margin: 0; } }
  #gpname { width: 100%; }
}
</style>
