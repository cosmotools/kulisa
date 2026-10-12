<script setup lang="ts">
// The island's row of tabs, its panel's header in the grid (docs/window.md, The terminal; Terminals.vue its terminals):
// each terminal's tab, then +, the dictation of the agent shown.
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import Icon from '../Icon.vue';
import Dictation from './Dictation.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import { agentMark } from '../../lib/agents';
import { newTerminalItems, tabItems } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { withKeys } from '../../lib/common';
import type { Terminal } from '../../types';

const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const tabOf = (e: MouseEvent) => store.terminals.list.find((t) => String(t.id) === (e.target as Element).closest<HTMLElement>('.termtab')?.dataset.id);
const menu = (e: MouseEvent) => { const t = tabOf(e); return t ? tabItems(t) : null; };
const title = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || 'Your shell in the task\'s folder');
const show = (id: string | number) => act('terminal:show', { id: Number(id) });
</script>

<template>
  <!-- The panel is not dragged by its tabs and buttons, only by the row's empty end. -->
  <div class="termtabs" :hidden="!store.terminals.list.length">
    <RightClickMenu :items="menu"><TabsRoot as-child :model-value="store.terminals.front === null ? undefined : String(store.terminals.front)"
      activation-mode="manual" @update:model-value="(v) => v !== undefined && show(v)"><TabsList as-child :loop="false">
      <nav aria-label="Terminals" @dragstart.prevent>
        <TabsTrigger v-for="t in store.terminals.list" :key="t.id" :value="String(t.id)" as-child>
          <div class="termtab striptab" :class="{ active: t.id === store.terminals.front }" :data-id="t.id" :title="title(t)">
            <button v-if="t.agent" class="handover icon quiet small" :aria-label="`${t.agent.name}: change agent…`"
              title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation" @mousedown.stop
              @click.stop="dialog('handover').then((d) => d.open(t))"><Icon :name="agentMark(t.agent.cli)!" /></button>
            <Icon v-else class="shellmark" name="i-agent-shell" />
            <span class="name">{{ t.name }}</span>
            <span class="state" :data-state="t.state || ''"><Icon :name="`i-${t.state || 'done'}`" /></span>
            <button class="close icon quiet small" aria-label="Close" :title="t.agent ? 'Close: the agent stops (asked first); its conversation stays in the task\'s history' : 'Close: what runs there stops'"
              @mousedown.prevent.stop @click="act('terminal:close', { id: t.id })"><Icon name="i-close" /></button>
          </div>
        </TabsTrigger>
      </nav>
    </TabsList></TabsRoot></RightClickMenu>
    <ButtonMenu :items="newTerminalItems"><button id="termAdd" class="add icon quiet small" :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')"
      aria-label="New terminal" @dragstart.prevent><Icon name="i-plus" /></button></ButtonMenu>
    <Dictation />
  </div>
</template>

<style>
/* The row over the terminal shown, apart from it as a browser's tabs: the row in the toolbar's color, the tab in front
   in the terminal's (.striptab.active), as if part of it. */
.termtabs { display: flex; align-items: center; gap: 4px; height: 100%; min-width: 0; padding-inline: calc(var(--gap) - 2px);
  &[hidden] { display: none; }
  nav { display: flex; align-items: center; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .termtab { padding-inline-start: 4px; max-width: 220px; }
  .shellmark { margin-inline: 6px; color: var(--text-dim); } }
#dock .dv-groupview:has(.termtabs) .dv-tabs-and-actions-container { background: var(--toolbar); }
</style>
