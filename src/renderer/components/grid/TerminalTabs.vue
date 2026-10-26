<script setup lang="ts">
// The island's row of tabs, its panel's header in the grid (docs/window.md, The terminal; Terminals.vue its terminals):
// each terminal's tab, then +; at its end the dictation's microphone (src/dictation).
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dictation } from '../../../dictation/renderer';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import AgentState from '../AgentState.vue';
import { agentMark } from '../../lib/agents';
import { newTerminalItems, shownTerm, tabItems } from '../../lib/terminals';
import { dialog } from '../../lib/dialogs';
import { keyText, withKeys } from '../../lib/common';
import { useStrip } from '../../lib/strip';
import type { Terminal } from '../../../shared/types';
import { MicIcon, PlusIcon, SquareTerminalIcon, XIcon } from '@lucide/vue';

const STATES = { working: 'is working', waiting: 'waits for you', done: 'is done' };
const tabOf = (e: MouseEvent) => store.terminals.list.find((t) => String(t.id) === (e.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id);
const menu = (e: MouseEvent) => { const t = tabOf(e); return t ? tabItems(t) : null; };
const title = (t: Terminal) => (t.agent ? `${t.agent.name}${t.state ? `: it ${STATES[t.state]}` : ''}` : t.command || 'Your shell in the task\'s folder');
const show = (id: string | number) => act('terminal:show', { id: Number(id) });
// More tabs than fit scroll (lib/strip.ts), the island's + and microphone kept in it.
const strip = ref<HTMLElement>();
useStrip(strip, () => store.terminals.front);
const language = computed(() => (store.language ? new Intl.DisplayNames(['en'], { type: 'language' }).of(store.language.language) ?? '' : ''));
</script>

<template>
  <!-- The panel is not dragged by its tabs and buttons, only by the row's empty end. -->
  <Tabs as-child class="h-full min-w-0 items-center gap-1 px-2 data-horizontal:flex-row" :model-value="store.terminals.front === null ? undefined : String(store.terminals.front)"
    activation-mode="manual" @update:model-value="(v) => v !== undefined && show(v)"><div data-testid="terminal-tabs" :hidden="!store.terminals.list.length">
    <RightClickMenu :items="menu"><TabsList as-child :loop="false" class="no-scrollbar max-w-full scroll-fade-x scroll-px-10 justify-start overflow-x-auto">
      <nav ref="strip" aria-label="Terminals" @dragstart.prevent>
        <!-- Its name whole, the row scrolls: shrunk, the tabs would show no name and look alike (an agent's mark is mostly
             the same) -->
        <TabsTrigger v-for="t in store.terminals.list" :key="t.id" :value="String(t.id)" as-child class="flex-none">
          <div :data-id="t.id" :aria-label="t.name" :title="title(t)">
            <Button v-if="t.agent" variant="ghost" size="icon-xs" :aria-label="`${t.agent.name}: change agent…`"
              title="Change agent: hand the task to another agent, or this one afresh; it goes on with this conversation" @mousedown.stop
              @click.stop="dialog('handover').then((d) => d.open(t))"><component :is="agentMark(t.agent.cli)!" /></Button>
            <SquareTerminalIcon v-else />
            <span class="truncate">{{ t.name }}</span>
            <AgentState :state="t.state" />
            <!-- Not a press on the tab: it is not chosen first. -->
            <Button as="span" variant="ghost" size="icon-xs" :title="t.agent ? 'Close: the agent stops (asked first); its conversation stays in the task\'s history' : 'Close: what runs there stops'"
              @mousedown.prevent @click="act('terminal:close', { id: t.id })"><XIcon /></Button>
          </div>
        </TabsTrigger>
      </nav>
    </TabsList></RightClickMenu>
    <ButtonMenu :items="newTerminalItems"><Button id="termAdd" variant="ghost" size="icon-sm" :title="withKeys('New conversation of an agent, or a terminal', 'terminal.new')"
      aria-label="New terminal" @dragstart.prevent><PlusIcon /></Button></ButtonMenu>
    <Dictation :task="store.current" :key-name="keyText('voice.hold')" :language="language" @done="shownTerm()?.focus()"><MicIcon /></Dictation>
  </div></Tabs>
</template>
