<script setup lang="ts">
// Choosing an agent for a task when the one to open is not there or not installed (tasks.md, "Choosing the agent").
// Asked once the grid it is for is on screen; closed without a choice (Cancel, another task shown), none opens.
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import Modal from './Modal.vue';
import AgentList from './AgentList.vue';
import { agentList } from '../lib/agents';
import { whenLeft } from '../lib/grid';

const modal = ref<InstanceType<typeof Modal>>();
const list = agentList({ choose: true, installed: (a) => `${a.name} is installed. Start it; it asks you to sign in.` });
let asking: string | null = null; // the task asked for
const startable = computed(() => !list.state.installing && !!list.chosen.value?.installed);

kulisa.on('agent:choose', async ({ task, selected }) => {
  await whenLeft();
  asking = task;
  await list.load(selected ?? undefined, () => modal.value!.open());
});

const answer = (id: string | null) => { const task = asking; asking = null; kulisa.send('agent:chosen', { task, id }); };
const closed = () => { if (asking !== null) answer(null); };
function start() {
  const a = list.chosen.value;
  if (!a?.installed) return;
  answer(a.id);
  modal.value!.close();
}
</script>

<template>
  <Modal id="agentpick" ref="modal" title="Choose the Agent" :closable="false" class="sm:max-w-xl" @close="closed">
    <p class="mb-4 text-muted-foreground">The agent works in a terminal of this task: it writes the code and uses the profiles. If it is not
      on this computer yet, Kulisa installs it with its maker's installer. On its first start it asks you to sign in.</p>
    <AgentList :list />
    <template #footer>
      <Button id="agentcancel" variant="outline" :disabled="list.state.installing" @click="modal!.close()">Cancel</Button>
      <Button id="agentstart" :disabled="!startable" @click="start">Start</Button>
    </template>
  </Modal>
</template>
