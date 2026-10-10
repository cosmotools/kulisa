<script setup lang="ts">
// The Agents window (☰, the Welcome screen; tasks.md, "Choosing the agent"): at any time, the agents with Install
// (AgentList.vue), each with its version, folder and its maker's website. Nothing is chosen or started here: the agent
// is chosen for a task when one is made, or with Change agent…. Add Account: for an agent that has accounts (Claude
// Code, Codex), a name; its folder is made, and it asks to sign in at its first start in a task.
import { computed, ref } from 'vue';
import { DialogClose, FormRoot } from 'reka-ui';
import Modal from './Modal.vue';
import SelectBox from './SelectBox.vue';
import AgentList from './AgentList.vue';
import { registerDialog } from '../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>(), list = ref<InstanceType<typeof AgentList>>();
const name = ref<HTMLInputElement>(), agent = ref('');
const error = ref('');
const own = computed(() => (list.value?.agents || []).filter((a) => a.accounts && !a.account));
const ownOptions = computed(() => own.value.map((a) => ({ value: a.agent!, label: a.name })));

registerDialog('agents', {
  async showAgents() {
    await list.value!.load(undefined, () => modal.value!.open());
    name.value!.value = ''; error.value = '';
    if (!own.value.some((a) => a.agent === agent.value)) agent.value = own.value[0]?.agent || '';
  },
});
async function add() {
  if (!name.value!.value.trim()) return name.value!.focus();
  const r = await kulisa.invoke<{ error?: string } | null>('accounts:add', { agent: agent.value, name: name.value!.value });
  if (r?.error) { error.value = r.error; return; }
  name.value!.value = ''; error.value = '';
  await list.value!.reload();
}
</script>

<template>
  <!-- While an agent installs, it stays (Esc, a click outside, ×). -->
  <Modal id="agents" ref="modal" title="Agents" :stay="!!list?.installing">
    <p class="hint">The agents Kulisa can run in a task's terminal, with their accounts. Install one here; choose it for a
      project (Project Settings…) or a task (Change agent… in the terminal's menu). An account is the agent with a sign-in
      of its own (a work and a personal one side by side): it asks you to sign in at its first start in a task. Yours
      (<code>~/.claude</code>, <code>~/.codex</code>) is the first.</p>
    <AgentList ref="list" details :installed="(a) => `${a.name} is installed. Choose it for a task; on its first start it asks you to sign in.`" />
    <FormRoot id="accountadd" class="row" :hidden="!own.length" @form-submit="add">
      <SelectBox id="accountagent" v-model="agent" :options="ownOptions" aria-label="Agent" />
      <input id="accountname" ref="name" data-name maxlength="64" placeholder="Account name, e.g. work" spellcheck="false" aria-label="Account name">
      <button id="accountaddbutton">Add Account</button>
    </FormRoot>
    <p id="accounterror" class="error">{{ error }}</p>
    <template #footer>
      <DialogClose class="primary" :disabled="list?.installing">Close</DialogClose>
    </template>
  </Modal>
</template>

<style>
#agents { width: 640px; }
</style>
