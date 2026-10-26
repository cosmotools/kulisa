<script setup lang="ts">
// An agent's install under way or done (lib/agents.ts, agentList): a line saying so, the installer's own
// output under Details (written for programmers: opened by itself only when it fails), the error. Settings → Agents,
// choosing an agent, New Project's agents.
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AgentList } from '../lib/agents';
import { ChevronDownIcon } from '@lucide/vue';

const { list } = defineProps<{ list: AgentList }>();
const state = list.state;
</script>

<template>
  <p class="mt-2 text-muted-foreground empty:hidden" role="status">{{ state.progress }}</p>
  <Collapsible :open="state.detailsOpen" :unmount-on-hide="false" :hidden="!state.showDetails" class="mt-1.5" @update:open="list.openDetails">
    <CollapsibleTrigger as-child><Button variant="link" size="sm" class="h-auto px-0 text-muted-foreground">Details<ChevronDownIcon
      class="transition-transform group-data-[state=open]/button:rotate-180" /></Button></CollapsibleTrigger>
    <!-- What the installer said is text to copy -->
    <CollapsibleContent><pre class="mt-1.5 max-h-44 overflow-auto rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap select-text">{{ state.log }}</pre></CollapsibleContent>
  </Collapsible>
  <p class="mt-2 text-destructive select-text empty:hidden">{{ state.error }}</p>
</template>
