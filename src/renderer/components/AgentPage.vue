<script setup lang="ts">
// An agent's page in Settings (tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it is,
// Install, and its accounts, a .list. The list's state (lib/agents.ts) lives with Settings, so an install goes on while
// a project is shown. Every agent's details are in the page, the chosen one's shown: a few agents, and an install's
// row keeps its state as another is looked at.
import { computed, ref, watch } from 'vue';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Icon from './Icon.vue';
import AccountSignIn from './AccountSignIn.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import type { MenuItem } from '../lib/menu';
import type { Agent, AgentList as List } from '../lib/agents';
import type { Account, AccountsInfo, SignedIn } from '../../shared/types';
import { refused } from '../../shared/result';

const props = defineProps<{ list: List; chosen?: string; accounts: Account[]; clis: string[] }>();
const emit = defineEmits<{ accounts: [r: Partial<AccountsInfo>] }>();
const s = props.list.state;
const error = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const accountSel = ref<string>();
watch(() => props.chosen, () => { accountSel.value = undefined; error.value = ''; });

// ~ for the home folder, as a terminal shows it.
const short = (p: string) => (s.home && p.startsWith(s.home + '/') ? '~' + p.slice(s.home.length) : p);
const where = (a: Agent) => (a.path ? [a.version, short(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '');
const installLine = (a: Agent) => (a.install && !a.installed ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '');
const status = (a: Agent) => (a.installed ? 'Installed' : 'Not installed');
const of = (a: Agent) => props.accounts.filter((x) => x.agent === a.id);
const projectsOf = (x: Account) => (x.projects.length ? `in ${x.projects.join(', ')}` : 'in no project');
const canSign = (a: Agent) => props.clis.includes(a.id);

async function remove(id = accountSel.value) {
  if (!id) return;
  error.value = '';
  const r = await kulisa.invoke('account:delete', { id });
  if (refused(r)) { error.value = r.error ?? ''; return; } // null: the human said no
  emit('accounts', r);
  if (!r.accounts.some((x) => x.id === accountSel.value)) accountSel.value = undefined; // deleted, not kept after a no
}
const accountMenu = (e: MouseEvent): MenuItem[] | null => {
  const id = (e.target as Element).closest<HTMLElement>('[data-account]')?.dataset.account;
  if (!id) return null;
  accountSel.value = id;
  return [{ label: 'Delete…', run: () => remove(id) }];
};
const newAccount = (a: Agent) => { error.value = ''; signing.value = a; };
function signedIn(r: SignedIn) { signing.value = null; emit('accounts', r); }
const busy = computed(() => !!signing.value);
defineExpose({ newAccount, busy });
</script>

<template>
  <div :ref="(el) => { s.el = el as HTMLElement | null; }" id="agentpage">
    <section v-for="a in s.agents" v-show="a.id === chosen" :key="a.id" class="agentdetail" :data-agent="a.id">
      <div class="field"><span>Maker:</span><span>{{ a.maker || '—' }}<template v-if="a.site"> · <a class="site" target="_blank" :href="a.site">Website</a></template></span></div>
      <div v-if="a.needs" class="field"><span>Needs:</span><span class="needs">{{ a.needs }}</span></div>
      <div class="field"><span>Status:</span><span class="installed"><span class="status">{{ status(a) }}</span><small class="where">{{ where(a) }}</small>
        <button type="button" class="install" :hidden="a.installed || !a.install" :disabled="s.installing" @click="list.install(a.id)">Install</button></span></div>
      <p class="install-line hint">{{ installLine(a) }}</p>

      <template v-if="canSign(a)">
        <h3 class="titled">Accounts</h3>
        <div class="list" :data-accounts="a.id">
          <div class="tools">
            <button class="accountnew icon small" type="button" title="New Account…: signed in with its own sign-in" aria-label="New Account"
              :disabled="!a.installed || busy" @click="newAccount(a)"><Icon name="i-plus" /></button>
            <button class="accountdel icon small" type="button" title="Delete the account (asks first)" aria-label="Delete the account"
              :disabled="!accountSel || !of(a).some((x) => x.id === accountSel)" @click="remove()"><Icon name="i-minus" /></button>
          </div>
          <div v-if="of(a).length" class="head" aria-hidden="true"><span>Account</span><span>Projects</span></div>
          <RightClickMenu :items="accountMenu">
            <ListboxRoot selection-behavior="replace" v-if="of(a).length" v-model="accountSel" aria-label="Accounts" @keydown.delete="remove()">
              <ListboxContent>
                <ListboxItem v-for="x in of(a)" :key="x.id" :value="x.id" class="item" :data-account="x.id">
                  <span class="cell label" :title="x.email || x.id">{{ x.email || x.id }}</span><small class="cell" :title="projectsOf(x)">{{ projectsOf(x) }}</small>
                </ListboxItem>
              </ListboxContent>
            </ListboxRoot>
          </RightClickMenu>
          <p v-if="!of(a).length" class="empty">No accounts yet.</p>
        </div>
        <AccountSignIn v-if="signing?.id === a.id" :agent="signing" @done="signedIn" @close="signing = null" />
      </template>
    </section>
    <p v-if="s.looking" class="empty">Looking for agents on this computer…</p>
    <p class="progress hint">{{ s.progress }}</p>
    <CollapsibleRoot v-model:open="s.detailsOpen" class="details" :hidden="!s.showDetails" :unmount-on-hide="false">
      <CollapsibleTrigger class="disclose"><Icon name="i-down" />Details</CollapsibleTrigger><CollapsibleContent><pre>{{ s.log }}</pre></CollapsibleContent>
    </CollapsibleRoot>
    <p class="error">{{ s.error }}</p>
    <p id="agentpageerror" class="error">{{ error }}</p>
  </div>
</template>

<style>
#agentpage { display: flex; flex-direction: column; gap: var(--gap);
  .agentdetail { display: flex; flex-direction: column; gap: var(--gap);
    .field { margin: 0; min-height: var(--control); } .titled { margin-top: var(--gap); }
    .installed { display: flex; align-items: center; gap: var(--gap); flex-wrap: wrap; small { color: var(--text-muted); } }
    .where { font-family: "JetBrains Mono", monospace; overflow-wrap: anywhere; &:empty { display: none; } }
    .install-line { margin: 0 0 0 calc(var(--label) + var(--inset)); font-family: "JetBrains Mono", monospace; overflow-wrap: anywhere; &:empty { display: none; } }
    .site { color: var(--text-muted); &:hover { color: var(--text); } }
    .list { --cols: fit-content(50%) minmax(0, 1fr); } } /* an account's email, its projects */
  :is(.progress, .error) { margin: 0; &:empty { display: none; } }
  .details[hidden] { display: none; }
  pre { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 8px; border-radius: var(--radius); background: var(--window);
    font: var(--font) "JetBrains Mono", monospace; white-space: pre-wrap; user-select: text; }
}
</style>
