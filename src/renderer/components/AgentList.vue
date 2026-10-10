<script lang="ts">
// The installer's output goes to the list that runs it.
let logTo: ((data: string) => void) | null = null;
kulisa.on<string>('agents:install-log', (data) => logTo?.(data));
</script>

<script setup lang="ts">
// The agents Kulisa knows (main/agents.js) as a list with Install, in both dialogs that show them: choosing a task's
// agent (AgentPicker.vue) and the Agents window (Agents.vue). Each row: who makes it and what it needs, whether it is
// on this computer; an account (main/accounts.js) under its agent. One that is not installed has an Install button:
// Kulisa runs its maker's installer (the command line is shown before). Meanwhile the list says only that it is
// installing: the installer's own output (written for programmers: "open a new terminal and run …") is under Details,
// opened by itself when it fails.
//   choose: a radio per row (choosing); details: each one's version, folder and website (the Agents window);
//   installed(agent): what to say once it is installed.
//   ref: load(selected, show) the agents, then show() (opens the dialog); reload(); chosen; installing; agents
import { computed, nextTick, ref } from 'vue';
import Icon from './Icon.vue';

interface Agent {
  id: string; name: string; maker?: string; needs?: string; site?: string; install?: string; installed?: boolean;
  account?: string; own?: string; accounts?: boolean; agent?: string; path?: string; onPath?: boolean; version?: string;
}
const props = withDefaults(defineProps<{ choose?: boolean; details?: boolean; installed: (a: Agent) => string }>(), { choose: false, details: false });
const agents = ref<Agent[]>([]);
const selected = ref<string | undefined>();
const installing = ref(false), looking = ref(false);
const progress = ref(''), log = ref(''), error = ref(''), showDetails = ref(false);
const rows = ref<HTMLElement>(), more = ref<HTMLDetailsElement>(), logEl = ref<HTMLElement>();
let home: string | null = null;
const chosen = computed(() => agents.value.find((a) => a.id === selected.value));

const fetchAgents = async () => ({ list: agents.value, home } = await kulisa.invoke('agents:list', props.details ? { details: true } : { check: true }));
// ~ for the home folder, as a terminal shows it.
const short = (p: string) => (home && p.startsWith(home + '/') ? '~' + p.slice(home.length) : p);
const needs = (a: Agent) => (a.account ? '' : [a.needs, a.own && `your account: ${short(a.own)}`].filter(Boolean).join(' · '));
const where = (a: Agent) => (!props.details ? '' : a.account ? `its own sign-in, in ${short(a.account)}`
  : a.path ? [a.version, short(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '');
const installLine = (a: Agent) => (a.install && !a.installed && !a.account ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '');
const status = (a: Agent) => (a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed');

// The dialog opens with the list in it (finding the agents takes a few tenths of a second: the user's shell, their
// --version), not with a line that flips to it at once; only when it takes longer, it opens saying so.
async function load(sel: string | undefined, show: () => void) {
  showDetails.value = false; log.value = ''; progress.value = ''; error.value = '';
  const waiting = setTimeout(() => { looking.value = true; agents.value = []; show(); }, 500);
  await fetchAgents();
  clearTimeout(waiting);
  looking.value = false;
  selected.value = sel ?? agents.value.find((a) => a.installed && a.install)?.id ?? agents.value.find((a) => a.install)?.id;
  show();
  focus();
}
// Again, after an account was added or removed.
async function reload() { await fetchAgents(); }
// Choosing: the arrows choose, Tab goes on to Install or Start.
const focus = async () => {
  await nextTick();
  (props.choose ? rows.value!.querySelector<HTMLElement>('input:checked') : rows.value!.querySelector<HTMLElement>('.install:not([hidden])'))?.focus();
};

async function remove(id: string) {
  const r = await kulisa.invoke<{ error?: string } | null>('accounts:remove', { id });
  if (!r?.error) await reload();
}
async function install(id: string) {
  const a = agents.value.find((x) => x.id === id)!;
  selected.value = id;
  installing.value = true;
  logTo = (data) => { log.value += data; nextTick(() => { logEl.value!.scrollTop = logEl.value!.scrollHeight; }); };
  showDetails.value = true; more.value!.open = false; log.value = ''; error.value = '';
  progress.value = `Installing ${a.name}…`;
  const r = await kulisa.invoke<{ installed?: boolean; error?: string; code?: number }>('agents:install', { id });
  installing.value = false;
  logTo = null;
  a.installed = !!r.installed;
  progress.value = a.installed ? props.installed(a) : '';
  if (!a.installed) {
    error.value = `${a.name} was not installed (${r.error || `the installer ended with code ${r.code}`}). What the installer said is under Details: try again, or choose another agent.`;
    more.value!.open = true;
  }
  // Where it went and its version.
  if (props.details && a.installed) await fetchAgents();
  focus();
}
defineExpose({ load, reload, chosen, installing, agents });
</script>

<template>
  <div class="agentlist">
    <div ref="rows" class="rows">
      <p v-if="looking" class="hint">Looking for agents on this computer…</p>
      <label v-for="a in agents" :key="a.id" class="agentrow" :class="{ account: !!a.account }" :data-agent="a.id">
        <input v-if="choose" v-model="selected" type="radio" name="agent" :value="a.id" :disabled="installing">
        <span class="what"><b class="name">{{ a.account || !a.maker ? a.name : `${a.name} · ${a.maker}` }}</b><small class="needs">{{ needs(a) }}</small>
          <small class="where">{{ where(a) }}</small><small class="install-line">{{ installLine(a) }}</small></span>
        <a class="site" target="_blank" :href="details && a.site && !a.account ? a.site : undefined">Website</a>
        <span class="status">{{ status(a) }}</span>
        <button type="button" class="install" :hidden="a.installed || !a.install || !!a.account" :disabled="installing"
          @click.prevent="install(a.id)">Install</button>
        <button type="button" class="remove icon quiet" title="Remove this account: its folder goes, with its sign-in (asks first)"
          aria-label="Remove account" :hidden="!(details && a.account)" :disabled="installing" @click.prevent="remove(a.id)"><Icon name="i-close" /></button>
      </label>
    </div>
    <p class="progress hint">{{ progress }}</p>
    <details ref="more" :hidden="!showDetails"><summary>Details</summary><pre ref="logEl">{{ log }}</pre></details>
    <p class="error">{{ error }}</p>
  </div>
</template>

<style>
.agentlist {
  .agentrow { display: flex; gap: var(--inset); align-items: center; padding: var(--inset) 4px; border-bottom: 1px solid var(--island-hi);
    input { height: auto; flex: none; }
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    small { color: var(--text-muted); }
    :is(.install-line, .where) { font-family: "JetBrains Mono", monospace; overflow-wrap: anywhere; &:empty { display: none; } }
    /* Choosing: what Install runs only for the chosen one */
    &:has(input:not(:checked)) .install-line { display: none; }
    .site { color: var(--text-muted); white-space: nowrap; &:hover { color: var(--text); } &:not([href]) { display: none; } }
    .status { color: var(--text-muted); white-space: nowrap; }
    /* An account of the agent above it, set in under it */
    &.account { padding-inline-start: 28px; } }
  .progress { margin: 10px 0 0; &:empty { display: none; } }
  details { margin-top: 6px; summary { color: var(--text-muted); } }
  pre { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 8px; border-radius: var(--radius); background: var(--window);
    font: 12px "JetBrains Mono", monospace; white-space: pre-wrap; user-select: text; }
}
</style>
