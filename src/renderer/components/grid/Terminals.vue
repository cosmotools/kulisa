<script setup lang="ts">
// The island of the task's terminals (docs/window.md, The terminal), a panel of the grid: the terminal in front, its
// tabs in the header (TerminalTabs.vue). The xterms live as long as their terminals (lib/terminals.ts); the panel holds
// the shown task's. With none, the island is folded to its + (by its height with a panel over or under it, by its width
// when it is as tall as the grid), and unfolds to the size it had when one opens. With no profile open it is the
// grid's room for them, so there the +'s rows are big buttons in its middle instead (docs/window.md, The terminal), the
// closed profiles' under them.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DockviewApi, DockviewPanelApi } from 'dockview-vue';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { store } from '../../lib/store';
import { profileLaunchers } from '../../lib/profiles';
import { island, launchers, newTerminalItems, tabItems, terminalMenu } from '../../lib/terminals';
import { termFocus } from '../../../terminal/renderer';
import { Pill } from '../../../dictation/renderer';
import { avatarSrc, withKeys } from '../../lib/common';
import { closing } from '../../lib/cover';
import AgentState from '../AgentState.vue';
import { CheckIcon, PlusIcon } from '@lucide/vue';

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
const STRIP = 36; // the header's height (app.css, --dv-tabs-and-actions-container-height)
let before: { width?: number; height?: number } | null = null;
function fold(on: boolean) {
  const group = props.params.api.group;
  if (!group) return;
  group.header.hidden = folded.value;
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
const launch = ref<{ $el: HTMLElement }>();
watch(() => folded.value && alone.value, async (on) => {
  if (!on) return;
  await nextTick();
  const a = document.activeElement;
  if (a && a !== document.body && !closing(a) && !root.value?.contains(a) && !launch.value?.$el.contains(a)) return;
  launch.value?.$el.querySelector<HTMLElement>('button')?.focus();
}, { immediate: true, flush: 'post' });

const menu = (e: MouseEvent) => {
  const t = (e.target as Element).closest('.xterm') && store.terminals.list.find((x) => x.id === store.terminals.front);
  return t ? terminalMenu(keyOf(t.id), tabItems(t)) : null;
};
</script>

<template>
  <div class="relative h-full data-folded:grid data-folded:place-items-center" data-testid="terminals" :data-folded="folded || undefined">
    <Empty v-if="folded && alone" ref="launch" data-testid="launchers">
      <EmptyHeader><EmptyTitle>Nothing open</EmptyTitle><EmptyDescription>Start an agent or a shell, or open a profile.</EmptyDescription></EmptyHeader>
      <EmptyContent>
        <nav class="flex flex-wrap justify-center gap-2" aria-label="New terminal">
          <Button v-for="l in launchers()" :key="l.id" variant="outline" :aria-label="l.name" :title="l.title" @click="l.run()">
            <component :is="l.icon" />{{ l.name }}<small v-if="l.sub" class="text-muted-foreground">{{ l.sub }}</small>
          </Button>
        </nav>
        <nav class="flex flex-wrap justify-center gap-2" aria-label="Open a profile">
          <Button v-for="p in profileLaunchers()" :key="p.id" variant="ghost" :data-profile="p.id" :title="p.title" @click="p.run()">
            <Avatar v-if="p.avatar" size="sm"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar><PlusIcon v-else />{{ p.name }}
          </Button>
        </nav>
      </EmptyContent>
    </Empty>
    <div v-else-if="folded"><ButtonMenu :items="newTerminalItems"><Button id="termUnfold" variant="ghost" size="icon-sm"
      :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')" aria-label="New terminal"><PlusIcon /></Button></ButtonMenu></div>
    <RightClickMenu :items="menu"><div ref="root" class="h-full" data-testid="terminal" :hidden="folded" /></RightClickMenu>
    <Pill v-if="!folded" :task="store.current"><CheckIcon /></Pill>
    <p v-if="starting" class="absolute inset-0 flex items-center justify-center gap-1.5 bg-background text-muted-foreground" role="status"><AgentState state="working" />Starting {{ starting.name }}…</p>
  </div>
</template>
