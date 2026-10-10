<script setup lang="ts">
// Choosing a task's agent (tasks.md, "Choosing the agent"): the agents with Install (AgentList.vue); Start starts the
// chosen one in the task's terminal, and on its first start the agent asks the human to sign in. Asked by the main
// process for a task whose agent is not chosen or not installed, once the grid it is for is on screen; and by Change
// agent…, which may be left as it is (Cancel). Closed without a choice (another task or project was shown): it is
// asked again when that task is shown again.
import { computed, ref } from 'vue';
import Modal from './Modal.vue';
import AgentList from './AgentList.vue';
import { registerDialog } from '../lib/dialogs';
import { whenLeft } from '../lib/grid';

const modal = ref<InstanceType<typeof Modal>>(), list = ref<InstanceType<typeof AgentList>>();
const cancellable = ref(false);
let asking: string | null = null; // the task asked for
const startable = computed(() => !list.value?.installing && !!list.value?.chosen?.installed);

async function chooseAgent({ task, selected, cancel }: { task: string; selected?: string; cancel?: boolean }) {
  asking = task;
  cancellable.value = !!cancel;
  await list.value!.load(selected, () => { if (!modal.value!.el!.open) modal.value!.open(); });
}
registerDialog('agentpick', { chooseAgent });
kulisa.on<{ task: string; selected?: string; cancel?: boolean }>('agent:choose', async (q) => { await whenLeft(); chooseAgent(q); });

const answer = (id: string | null) => { const task = asking; asking = null; kulisa.send('agent:chosen', { task, id }); };
const closed = () => { if (asking !== null) answer(null); };
function start() {
  const a = list.value!.chosen;
  if (!a?.installed) return;
  answer(a.id);
  modal.value!.close();
}
</script>

<template>
  <Modal id="agentpick" ref="modal" title="Choose the Agent" :closable="false" closedby="none" @close="closed">
    <p class="hint">The agent works in this task's terminal: it writes the code and uses the profiles. If it is not on this
      computer yet, Kulisa installs it with its maker's installer. On its first start it asks you to sign in.</p>
    <AgentList ref="list" choose :installed="(a) => `${a.name} is installed. Start it; it asks you to sign in.`" />
    <template #footer>
      <button id="agentcancel" :hidden="!cancellable" :disabled="list?.installing" @click="modal!.close()">Cancel</button>
      <button id="agentstart" class="primary" :disabled="!startable" @click="start">Start</button>
    </template>
  </Modal>
</template>

<style>
#agentpick { width: 640px; }
</style>
