<script setup lang="ts">
// The island's row of tabs, its panel's header in the grid (docs/window.md, The terminal; Terminals.vue its terminals):
// each terminal's tab, then +; at its end the dictation's microphone (src/dictation).
import { computed, ref } from 'vue';
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { Dictation } from '../../../dictation/renderer';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import { agentMark, STATE_ICONS } from '../../lib/agents';
import { newTerminalItems, shownTerm, tabItems } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { keyText, withKeys } from '../../lib/common';
import { useStrip } from '../../lib/strip';
import type { Terminal } from '../../../shared/types';
import { MicIcon, PlusIcon, SquareTerminalIcon, XIcon } from '@lucide/vue';

const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const tabOf = (e: MouseEvent) => store.terminals.list.find((t) => String(t.id) === (e.target as Element).closest<HTMLElement>('.termtab')?.dataset.id);
const menu = (e: MouseEvent) => { const t = tabOf(e); return t ? tabItems(t) : null; };
const title = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || 'Your shell in the task\'s folder');
const show = (id: string | number) => act('terminal:show', { id: Number(id) });
// More tabs than fit scroll (lib/strip.ts): they were cut off at the island's edge, its + and microphone with them.
const strip = ref<HTMLElement>();
useStrip(strip, () => store.terminals.front);
const language = computed(() => (store.language ? new Intl.DisplayNames(['en'], { type: 'language' }).of(store.language.language) ?? '' : ''));
</script>

<template>
  <!-- The panel is not dragged by its tabs and buttons, only by the row's empty end. -->
  <div class="termtabs" data-testid="terminal-tabs" :hidden="!store.terminals.list.length">
    <RightClickMenu :items="menu"><TabsRoot as-child :model-value="store.terminals.front === null ? undefined : String(store.terminals.front)"
      activation-mode="manual" @update:model-value="(v) => v !== undefined && show(v)"><TabsList as-child :loop="false">
      <nav ref="strip" class="tabstrip" aria-label="Terminals" @dragstart.prevent>
        <TabsTrigger v-for="t in store.terminals.list" :key="t.id" :value="String(t.id)" as-child>
          <div class="termtab tab" :data-id="t.id" :aria-label="t.name" :title="title(t)">
            <button v-if="t.agent" class="handover icon quiet small" :aria-label="`${t.agent.name}: change agent…`"
              title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation" @mousedown.stop
              @click.stop="dialog('handover').then((d) => d.open(t))"><component :is="agentMark(t.agent.cli)!" /></button>
            <SquareTerminalIcon v-else class="shellmark" />
            <span class="title">{{ t.name }}</span>
            <span class="state" :data-state="t.state || ''"><component :is="STATE_ICONS[t.state || 'done']" /></span>
            <!-- Not a press on the tab: it is not chosen first. -->
            <span class="x icon small" :title="t.agent ? 'Close: the agent stops (asked first); its conversation stays in the task\'s history' : 'Close: what runs there stops'"
              @mousedown.prevent @click="act('terminal:close', { id: t.id })"><XIcon /></span>
          </div>
        </TabsTrigger>
      </nav>
    </TabsList></TabsRoot></RightClickMenu>
    <ButtonMenu :items="newTerminalItems"><button id="termAdd" class="add icon quiet small" :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')"
      aria-label="New terminal" @dragstart.prevent><PlusIcon /></button></ButtonMenu>
    <Dictation :task="store.current" :key-name="keyText('voice.hold')" :language="language" @done="shownTerm()?.focus()"><MicIcon /></Dictation>
  </div>
</template>

<style>
/* The row over the terminal shown, as a pane's tabs (.tab): the row in the island's color, the tab in front in the
   terminal's, joined to it. The tabs stand on the row's foot: the header's margin above them, none below. */
.termtabs { display: flex; align-items: center; gap: 4px; height: 100%; min-width: 0; padding: 4px calc(var(--gap) - 2px) 0;
  &[hidden] { display: none; }
  nav { display: flex; align-items: end; align-self: stretch; min-width: 0; } /* .tabstrip: more tabs than fit scroll */
  /* its name whole, the row scrolls: shrunk, the tabs would show no name and look alike (an agent's mark is mostly the
     same), so not shrunk as a pane's, nor as wide: as its name, up to a pane's tab's width */
  .termtab { flex: none; width: auto; max-width: 220px; container-type: normal; padding-inline-start: 4px; }
  .shellmark { margin-inline: 6px; color: var(--text-dim); } }
/* The row is as wide as the island, not as its tabs: dockview's tab grows to its content (min-width: auto), and a row
   of many terminals would run past the island, cut off there, its + and microphone with it. No margin above and
   below: the row's own padding places the tabs, at its foot. */
#dock .dv-tab:has(.termtabs) { min-width: 0; flex-shrink: 1; margin-block: 0; }
</style>
