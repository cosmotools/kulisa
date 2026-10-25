<script setup lang="ts">
// The agents Kulisa knows (lib/agents.ts) as a list with Install, in choosing a task's agent (AgentPicker.vue), whose
// state it draws (list); slot after: what goes under an agent's row there (its accounts). Each row: who makes it and
// what it needs, whether it is on this computer; choosing, the project's accounts (main/accounts.ts). One that is not
// installed has an Install button: Kulisa runs its maker's installer (the command line is shown before). Meanwhile the
// list says only that it is installing: the installer's own output (written for programmers: "open a new terminal and
// run …") is under Details, opened by itself when it fails (InstallProgress.vue). Choosing, the rows are Reka's
// RadioGroup.
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import Icon from './Icon.vue';
import InstallProgress from './InstallProgress.vue';
import { agentMark, shortPath, type Agent, type AgentList } from '../lib/agents';

const props = defineProps<{ list: AgentList }>();
const s = props.list.state;
const short = (p: string) => shortPath(p, s.home);
const needs = (a: Agent) => (a.account ? '' : a.needs || '');
const where = (a: Agent) => (!props.list.details ? '' : a.account ? `its own sign-in, in ${short(a.account)}`
  : a.path ? [a.version, short(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '');
const installLine = (a: Agent) => (a.install && !a.installed && !a.account ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '');
const mark = (a: Agent) => agentMark(a.agent || a.id, null);
const status = (a: Agent) => (a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed');
</script>

<template>
  <div :ref="(el) => { s.el = el as HTMLElement | null; }" class="agentlist">
    <RadioGroupRoot v-model="s.selected" class="rows" aria-label="Agents" :disabled="s.installing">
      <p v-if="s.looking" class="hint">Looking for agents on this computer…</p>
      <template v-for="a in s.agents" :key="a.id"><label class="agentrow" :class="{ account: !!a.account }" :data-agent="a.id">
        <RadioGroupItem v-if="list.choose" class="radio" :value="a.id"><RadioGroupIndicator /></RadioGroupItem>
        <Icon v-if="mark(a)" class="logo" :name="mark(a)!" />
        <span class="what"><b class="name">{{ a.account || !a.maker ? a.name : `${a.name} · ${a.maker}` }}</b><small class="needs">{{ needs(a) }}</small>
          <small class="where">{{ where(a) }}</small><small class="install-line">{{ installLine(a) }}</small></span>
        <a class="site" target="_blank" :href="list.details && a.site && !a.account ? a.site : undefined">Website</a>
        <span class="status">{{ status(a) }}</span>
        <button type="button" class="install" :hidden="a.installed || !a.install || !!a.account" :disabled="s.installing"
          @click.prevent="list.install(a.id)">Install</button>
      </label><slot name="after" :agent="a" /></template>
    </RadioGroupRoot>
    <InstallProgress :list />
  </div>
</template>

<style>
.agentlist {
  .agentrow { display: flex; gap: var(--inset); align-items: center; padding: var(--inset) 4px; border-bottom: 1px solid var(--island-hi);
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .logo { width: 20px; height: 20px; align-self: flex-start; }
    small { color: var(--text-muted); }
    :is(.install-line, .where) { font-family: "JetBrains Mono", monospace; overflow-wrap: anywhere; &:empty { display: none; } }
    /* Choosing: what Install runs only for the chosen one */
    &:has([role="radio"][data-state="unchecked"]) .install-line { display: none; }
    .site { color: var(--text-muted); white-space: nowrap; &:hover { color: var(--text); } &:not([href]) { display: none; } }
    .status { color: var(--text-muted); white-space: nowrap; } }
}
</style>
