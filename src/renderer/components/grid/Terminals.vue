<script setup lang="ts">
// The island of the task's terminals (docs/window.md, The terminal), a panel of the grid: the terminal in front, its
// tabs in the header (TerminalTabs.vue). The xterms live as long as their terminals (lib/terminals.ts); the panel holds
// the shown task's. With none, the island is folded to its + (by its height with a panel over or under it, by its width
// when it is as tall as the grid), and unfolds to the size it had when one opens. With no profile open it is the
// grid's room for them, so there the group is not drawn and the +'s rows are big buttons in its middle instead
// (docs/window.md, The terminal), the closed profiles' under them.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DockviewApi, DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { store } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { island, launchers, newTerminalItems, tabItems, terminalMenu } from '../../lib/terminals';
import { termFocus } from '../../../terminal/renderer';
import { Pill } from '../../../dictation/renderer';
import { avatarSrc, withKeys } from '../../lib/common';

const props = defineProps<{ params: { api: DockviewPanelApi; containerApi: DockviewApi } }>();
const root = ref<HTMLElement>();
const keyOf = (id: number) => `${store.terminals.task}#${id}`;
const folded = computed(() => !store.terminals.list.length);
const grid = props.params.containerApi, alone = ref(true);
const count = () => { alone.value = !grid.panels.some((p) => p.id.startsWith('profile:')); };
const subs = [grid.onDidAddPanel(count), grid.onDidRemovePanel(count)];

// The window's one xterm in the panel, showing the terminal in front.
function place() {
  if (island.el.parentElement !== root.value) root.value!.append(island.el);
  const front = store.terminals.list.find((t) => t.id === store.terminals.front);
  island.show(front ? keyOf(front.id) : null);
}

// Folding: the island's group held at one button's size along the grid's axis it lies across (dockview's constraints),
// its header gone; its size before, given back when it unfolds.
const STRIP = 36; // the header's height (Grid.vue): one button with the island's margins
let before: { width?: number; height?: number } | null = null;
function fold(on: boolean) {
  const group = props.params.api.group;
  if (!group) return;
  group.header.hidden = folded.value;
  group.element.classList.toggle('termalone', folded.value && alone.value);
  if (on) {
    if (before) return;
    const box = group.api.boundingBox, dock = document.querySelector('#dock .dv-dockview')?.getBoundingClientRect();
    const across = !box || !dock || box.height < dock.height - 1; // a panel over or under it: folded by its height
    before = across ? { height: group.api.height } : { width: group.api.width };
    const size = across ? { minimumHeight: STRIP, maximumHeight: STRIP } : { minimumWidth: STRIP, maximumWidth: STRIP };
    group.api.setConstraints(size);
    group.api.setSize(across ? { height: STRIP } : { width: STRIP });
  } else if (before) {
    group.api.setConstraints({ minimumHeight: 0, maximumHeight: Number.MAX_SAFE_INTEGER, minimumWidth: 0, maximumWidth: Number.MAX_SAFE_INTEGER });
    group.api.setSize(before.height ? { height: Math.max(before.height, 150) } : { width: Math.max(before.width!, 200) });
    before = null;
  }
}

const strip = computed(() => folded.value && !alone.value);
// The tab in front before its program has started (an agent's is looked for first): a loader over its terminal, which
// stays laid out meanwhile (the program starts at its size).
const starting = computed(() => store.terminals.list.find((t) => t.id === store.terminals.front && t.starting));
onMounted(() => { count(); place(); fold(strip.value); });
watch(() => [store.terminals.task, store.terminals.front, store.terminals.list.map((t) => t.id).join()], place, { flush: 'post' });
// Another tab in front of the same task (chosen, or opened by the human): the keyboard goes to it.
watch(() => [store.terminals.task, store.terminals.front] as const, ([task, front], [before, was]) => {
  if (task === before && front !== was && front !== null) void termFocus(keyOf(front));
}, { flush: 'post' });
watch([folded, strip, alone], () => fold(strip.value), { flush: 'post' });
onBeforeUnmount(() => { for (const s of subs) s.dispose(); if (island.el.parentElement === root.value) island.el.remove(); });

// The buttons in an empty grid, each a Tab stop (Tab to the next, Enter opens it): the first,
// the project's default agent, gets the keyboard when the keyboard was in the terminal just closed or nowhere (not
// taken from a field or a dialog). No keys on them: Ctrl+` opens the task's agent, which the window does not show.
const launch = ref<HTMLElement>();
watch(() => folded.value && alone.value, async (on) => {
  if (!on) return;
  await nextTick();
  const a = document.activeElement;
  if (a && a !== document.body && !root.value?.contains(a) && !launch.value?.contains(a)) return;
  launch.value?.querySelector<HTMLElement>('.launcher')?.focus();
}, { immediate: true, flush: 'post' });

const menu = (e: MouseEvent) => {
  const t = (e.target as Element).closest('.term') && store.terminals.list.find((x) => x.id === store.terminals.front);
  return t ? terminalMenu(keyOf(t.id), tabItems(t)) : null;
};
</script>

<template>
  <div class="terminals" :class="{ folded, alone: folded && alone }">
    <div v-if="folded && alone" ref="launch" class="launch">
      <nav class="agents" aria-label="New terminal">
        <button v-for="l in launchers()" :key="l.id" class="launcher" :title="l.title" @click="l.run()">
          <Icon :name="l.icon" /><span class="name">{{ l.name }}</span><small v-if="l.sub">{{ l.sub }}</small>
        </button>
      </nav>
      <nav class="profiles" aria-label="Open a profile">
        <button v-for="p in profileLaunchers()" :key="p.id" class="launcher" :data-profile="p.id" :title="p.title" @click="p.run()">
          <img v-if="p.avatar" class="avatar" :src="avatarSrc(p.avatar)" alt=""><Icon v-else name="i-plus" />
          <span class="name">{{ p.name }}</span>
        </button>
      </nav>
    </div>
    <div v-else-if="folded" class="strip"><ButtonMenu :items="newTerminalItems"><button id="termUnfold" class="add icon quiet"
      :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')" aria-label="New terminal"><Icon name="i-plus" /></button></ButtonMenu></div>
    <RightClickMenu :items="menu"><div ref="root" class="termpanel" :hidden="folded" /></RightClickMenu>
    <Pill v-if="!folded" :task="store.current"><Icon name="i-done" /></Pill>
    <p v-if="starting" class="starting"><span class="state" data-state="working"><Icon name="i-working" /></span>Starting {{ starting.name }}…</p>
  </div>
</template>

<style>
/* The terminal in the toolbar's color, as a pane's toolbar under its tabs: the tab in front joins it (TerminalTabs.vue) */
.terminals { height: 100%; position: relative;
  &:not(.folded) { background: var(--toolbar); border-radius: 0 0 var(--island-radius) var(--island-radius); }
  .starting { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: inherit; background: var(--toolbar); color: var(--text-muted); }
  &.folded { display: flex; flex-direction: column; justify-content: center; }
  .strip { display: grid; place-items: center; height: 100%; }
  .launch { display: flex; flex-direction: column; gap: calc(var(--gap) * 2); padding: var(--gap);
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--gap) * 2); } }
}
#dock .termalone { --dv-group-view-background-color: transparent; --dv-tabs-and-actions-container-background-color: transparent; }
.termpanel { height: 100%; &[hidden] { display: none; } }
.term { height: 100%; padding: 2px 4px 2px 8px; &[hidden] { display: none; } }
/* The rows that fit, in the middle: what is left under a whole row (the panel's height is any) shared above and
   below, so no edge gets a row's height of it and a pixel more or less never costs a row. */
.xterm-host { height: 100%; display: flex; flex-direction: column; justify-content: center; }
</style>
