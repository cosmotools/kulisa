<script setup lang="ts">
// Settings → Agents (ProjectEditor.vue; ☰ → Agents… opens it; tasks.md, "Choosing the agent"): the agents Kulisa can
// run, each with its version, folder, website and Install (AgentList.vue: list, whose state lives with Settings, so an
// install goes on while the other tab is shown), and under each agent with accounts its accounts: the email, the
// projects it is in, × deletes it (Delete Account…: refused while a task runs it, asked first; main/projects.js), New
// Account… makes one, signed in right here (AccountSignIn.vue), in no project yet (a project's Add Agent… takes it).
// An account lives until it is deleted here: a project let go of it, or deleted, keeps it (the author, 2026-10-11).
import { ref, watch } from 'vue';
import Icon from './Icon.vue';
import AgentList from './AgentList.vue';
import AccountSignIn from './AccountSignIn.vue';
import type { Agent, AgentList as List } from '../lib/agents';
import type { Account, AccountsInfo, SignedIn } from '../types';

const props = defineProps<{ list: List; active: boolean }>();
const accounts = ref<Account[]>([]), clis = ref<string[]>([]), error = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const show = (r: Partial<AccountsInfo>) => { if (r.accounts) accounts.value = r.accounts; if (r.clis) clis.value = r.clis; };
// Shown: the agents looked for (their versions, where they are) and the accounts.
watch(() => props.active, async (on) => {
  if (!on) return;
  error.value = '';
  show(await kulisa.invoke<AccountsInfo>('accounts:list'));
  await props.list.load(undefined, async () => {});
}, { immediate: true });
const of = (a: Agent) => accounts.value.filter((x) => x.agent === a.id);
const where = (x: Account) => (x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project');
async function remove(id: string) {
  error.value = '';
  const r = await kulisa.invoke<AccountsInfo & { error?: string | null }>('account:delete', { id });
  if (r.error) error.value = r.error; else show(r);
}
function signedIn(r: SignedIn) { signing.value = null; show(r); }
</script>

<template>
  <div id="agentstab">
    <p class="hint">The agents Kulisa can run in a task's terminal, and their accounts: each its own sign-in, a work and a
      personal one side by side. A project's tasks run the accounts its page lists (Add Agent…).</p>
    <AgentList :list>
      <template #after="{ agent }">
        <div v-if="clis.includes(agent.id)" class="accounts" :data-accounts="agent.id">
          <div v-for="x in of(agent)" :key="x.id" class="removable" :data-account="x.id">
            <div class="item"><span class="text"><span class="label">{{ x.email || x.id }}</span><small>{{ where(x) }}</small></span></div>
            <button class="remove icon quiet" type="button" title="Delete the account (asks first)" aria-label="Delete the account"
              @click="remove(x.id)"><Icon name="i-close" /></button>
          </div>
          <p v-if="!of(agent).length" class="empty">No accounts yet.</p>
          <div class="row" :hidden="!!signing"><button class="accountnew" type="button" :disabled="!agent.installed"
            :title="agent.installed ? '' : 'Install it first'" @click="error = ''; signing = agent">New Account…</button></div>
          <AccountSignIn v-if="signing?.id === agent.id" :agent="signing" @done="signedIn" @close="signing = null" />
        </div>
      </template>
    </AgentList>
    <p id="agentstaberror" class="error">{{ error }}</p>
  </div>
</template>

<style>
/* An agent's accounts under its row, set in from its name */
#agentstab {
  .hint { margin-block-start: 0; }
  .accounts { display: flex; flex-direction: column; gap: 2px; padding: var(--inset) 0 var(--inset) var(--pad); border-bottom: 1px solid var(--island-hi);
    .empty { margin: 0; } .row { margin-block-start: 4px; } }
}
</style>
