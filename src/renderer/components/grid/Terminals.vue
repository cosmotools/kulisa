<script setup lang="ts">
// The island of the task's terminals (docs/window.md, The terminal), a panel of the grid: the terminal in front, its
// tabs in the header (TerminalTabs.vue). The xterms live as long as their terminals (lib/terminals.ts); the panel holds
// the shown task's. With none, the island is folded to its + (by its height under or over the grid, by its width at a
// side), and unfolds to the size it had when one opens. Alone in the grid (no profile open) its group fills the grid
// whatever is asked of it, so there the group is not drawn and the +'s rows are big buttons in its middle instead
// (docs/window.md, The terminal), the closed profiles' under them.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DockviewApi, DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { store } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { launchers, newTerminalItems, tabItems, terminalMenu } from '../../lib/terminals';
import { termFocus, termHost } from '../../lib/xterm';
import { avatarSrc, withKeys } from '../../lib/common';

const props = defineProps<{ params: { api: DockviewPanelApi; containerApi: DockviewApi } }>();
const root = ref<HTMLElement>();
const keyOf = (id: number) => `${store.terminals.task}#${id}`;
const folded = computed(() => !store.terminals.list.length);
const grid = props.params.containerApi, alone = ref(true);
const count = () => { alone.value = grid.panels.length < 2; };
const subs = [grid.onDidAddPanel(count), grid.onDidRemovePanel(count)];

// The shown task's terminals in the panel, the one in front shown.
function place() {
  const el = root.value!;
  const keys = store.terminals.list.map((t) => keyOf(t.id));
  for (const host of [...el.querySelectorAll<HTMLElement>(':scope > .term')]) if (!keys.some((k) => termHost(k) === host)) host.remove();
  for (const t of store.terminals.list) {
    const host = termHost(keyOf(t.id));
    if (host.parentElement !== el) el.append(host);
    host.hidden = t.id !== store.terminals.front;
  }
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
    const across = !box || !dock || box.width >= dock.width - 1; // under or over the grid: folded by its height
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
onBeforeUnmount(() => { for (const s of subs) s.dispose(); for (const host of [...root.value!.children]) host.remove(); });

// The buttons in an empty grid, each a Tab stop (Tab to the next, Enter opens it; the author, 2026-10-12): the first,
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
  const host = (e.target as Element).closest('.term'), t = store.terminals.list.find((x) => host && termHost(keyOf(x.id)) === host);
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
          <span class="name">{{ p.name }}</span><small v-if="p.sub">{{ p.sub }}</small>
        </button>
      </nav>
    </div>
    <div v-else-if="folded" class="strip"><ButtonMenu :items="newTerminalItems"><button id="termUnfold" class="add icon quiet"
      :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')" aria-label="New terminal"><Icon name="i-plus" /></button></ButtonMenu></div>
    <RightClickMenu :items="menu"><div ref="root" class="termpanel" :hidden="folded" /></RightClickMenu>
    <p v-if="starting" class="starting"><span class="state" data-state="working"><Icon name="i-working" /></span>Starting {{ starting.name }}…</p>
  </div>
</template>

<style>
.terminals { height: 100%; position: relative;
  .starting { position: absolute; inset: 0; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px;
    background: var(--island); color: var(--text-muted); }
  &.folded { display: flex; flex-direction: column; justify-content: center; }
  .strip { display: grid; place-items: center; height: 100%; }
  .launch { display: flex; flex-direction: column; gap: calc(var(--gap) * 2); padding: var(--gap);
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--gap) * 2); } }
}
#dock .termalone { --dv-group-view-background-color: transparent; --dv-tabs-and-actions-container-background-color: transparent; }
.termpanel { height: 100%; &[hidden] { display: none; } }
.term { height: 100%; padding: 2px 4px 2px 8px; &[hidden] { display: none; } }
/* The rows that fit, in the middle: what is left under a whole row (the panel's height is any) shared above and
   below, so no edge gets a row's height of it and a pixel more or less never costs a row (2026-10-08). */
.xterm-host { height: 100%; display: flex; flex-direction: column; justify-content: center; }
</style>
