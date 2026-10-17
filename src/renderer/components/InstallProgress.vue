<script setup lang="ts">
// An agent's install under way or done (lib/agents.ts, agentList): a line saying so, the installer's own
// output under Details (written for programmers: opened by itself only when it fails), the error. Settings → Agents,
// choosing an agent, New Project's agents.
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui';
import Icon from './Icon.vue';
import type { AgentList } from '../lib/agents';

const { list } = defineProps<{ list: AgentList }>();
const state = list.state;
</script>

<template>
  <div class="installprogress">
    <p class="progress hint">{{ state.progress }}</p>
    <CollapsibleRoot :open="state.detailsOpen" @update:open="list.openDetails" class="details" :hidden="!state.showDetails" :unmount-on-hide="false">
      <CollapsibleTrigger class="disclose"><Icon name="i-down" />Details</CollapsibleTrigger><CollapsibleContent><pre>{{ state.log }}</pre></CollapsibleContent>
    </CollapsibleRoot>
    <p class="error">{{ state.error }}</p>
  </div>
</template>

<style>
.installprogress { display: contents;
  .progress { margin: 10px 0 0; }
  :is(.progress, .error):empty { display: none; }
  .details { margin-top: 6px; &[hidden] { display: none; } }
  pre { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 8px; border-radius: var(--radius); background: var(--window);
    font: var(--font) "JetBrains Mono", monospace; white-space: pre-wrap; user-select: text; }
}
</style>
