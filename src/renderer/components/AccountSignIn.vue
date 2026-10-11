<script setup lang="ts">
// A new account of an agent, made in the projects' manager (ProjectEditor.vue; tasks.md, Accounts): the agent's own
// sign-in (Claude Code's `auth login`, as its /login) starts at once in a terminal here, where the human follows it;
// its page opens in a clean browser of Kulisa's (main/master.js). Once it ends signed in, the account (named by the email
// it signed in to) is the project's (done, with the project's agents); Cancel, or the manager closed, stops it and
// nothing is kept. A terminal as the task's other ones (lib/terminals.ts), keyed "signin#<n>".
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { forgetTerminals, termHost, terminalOf } from '../lib/terminals';

const props = defineProps<{ project: string; agent: { id: string; name: string } }>();
const emit = defineEmits<{ done: [agents: { id: string; name: string }[]]; close: [] }>();
let n = 0;
const host = ref<HTMLElement>();
const running = ref(''), error = ref(''); // running: the sign-in terminal's key

async function start() {
  error.value = '';
  const key = running.value = `signin#${Date.now()}-${++n}`;
  host.value!.replaceChildren(termHost(key));
  terminalOf(key).term.focus();
  const r = await kulisa.invoke<{ error?: string | null; agents?: { id: string; name: string }[] }>('account:signin',
    { id: props.project, agent: props.agent.id, key });
  forgetTerminals([key]);
  if (running.value === key) running.value = '';
  if (r.agents) emit('done', r.agents);
  else if (r.error) error.value = r.error;
}
async function stop() {
  const key = running.value;
  running.value = '';
  if (key) await kulisa.invoke('account:signin-cancel', { key });
}
async function cancel() { await stop(); emit('close'); }
onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <div id="npsignin">
    <p class="hint">Signing in to a new account of {{ agent.name }}: it opens its sign-in page in a clean browser of
      Kulisa's, where none of your accounts is signed in. The account is added once you are signed in.</p>
    <div id="npsigninterm" ref="host" :hidden="!running" />
    <p id="npsigninerror" class="error">{{ error }}</p>
    <div class="row">
      <button id="npsigninstart" type="button" :hidden="!!running" @click="start">Try Again</button>
      <button id="npsignincancel" type="button" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<style>
/* Its terminal, a few rows high, framed as a field */
#npsignin {
  .hint { margin-block: 0 var(--inset); }
  #npsigninterm { height: 160px; border: 1px solid var(--line); border-radius: var(--radius); &[hidden] { display: none; } }
}
</style>
