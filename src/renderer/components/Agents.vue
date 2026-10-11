<script setup lang="ts">
// The Agents window (☰, the Welcome screen; tasks.md, "Choosing the agent"): at any time, the agents with Install
// (AgentList.vue), each with its version, folder and its maker's website. Nothing is chosen or started here: the agent
// is chosen for a task when one is made, or with Change agent…. The agents alone: their accounts are made and chosen in
// a project's configuration (Projects…, New Account…).
import { ref } from 'vue';
import { DialogClose } from 'reka-ui';
import Modal from './Modal.vue';
import AgentList from './AgentList.vue';
import { registerDialog } from '../lib/dialogs';
import { agentList } from '../lib/agents';

const modal = ref<InstanceType<typeof Modal>>();
const list = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it in a project's settings (New Account…).` });

registerDialog('agents', {
  async showAgents() {
    await list.load(undefined, () => modal.value!.open());
  },
});
</script>

<template>
  <!-- While an agent installs, it stays (Esc, a click outside, ×). -->
  <Modal id="agents" ref="modal" title="Agents" :stay="list.state.installing">
    <p class="hint">The agents Kulisa can run in a task's terminal. Install one here; choose it for a project (Project
      Settings…) or a task (Change agent… in the terminal's menu). An account of its own (a work and a personal one side
      by side) is made in a project's settings, New Account…; yours (<code>~/.claude</code>, <code>~/.codex</code>) is
      always there.</p>
    <AgentList :list />
    <template #footer>
      <DialogClose class="primary" :disabled="list.state.installing">Close</DialogClose>
    </template>
  </Modal>
</template>

<style>
#agents { width: 640px; }
</style>
