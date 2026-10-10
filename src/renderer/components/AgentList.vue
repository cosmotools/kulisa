<script setup lang="ts">
// The agents Kulisa knows (lib/agents.ts) as a list with Install, in both dialogs that show them: choosing a task's
// agent (AgentPicker.vue) and the Agents window (Agents.vue), whose state it draws (list). Each row: who makes it and
// what it needs, whether it is on this computer; an account (main/accounts.js) under its agent. One that is not
// installed has an Install button: Kulisa runs its maker's installer (the command line is shown before). Meanwhile the
// list says only that it is installing: the installer's own output (written for programmers: "open a new terminal and
// run …") is under Details, opened by itself when it fails (Reka's Collapsible). Choosing, the rows are Reka's
// RadioGroup.
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import Icon from './Icon.vue';
import type { Agent, AgentList } from '../lib/agents';

const props = defineProps<{ list: AgentList }>();
const s = props.list.state;
// ~ for the home folder, as a terminal shows it.
const short = (p: string) => (s.home && p.startsWith(s.home + '/') ? '~' + p.slice(s.home.length) : p);
const needs = (a: Agent) => (a.account ? '' : [a.needs, a.own && `your account: ${short(a.own)}`].filter(Boolean).join(' · '));
const where = (a: Agent) => (!props.list.details ? '' : a.account ? `its own sign-in, in ${short(a.account)}`
  : a.path ? [a.version, short(a.path), a.onPath === false && 'not on your PATH: Kulisa runs it from here'].filter(Boolean).join(' · ') : '');
const installLine = (a: Agent) => (a.install && !a.installed && !a.account ? `Install runs ${a.maker || 'its maker'}'s installer: ${a.install}` : '');
const status = (a: Agent) => (a.installed ? (a.install && !a.account ? 'Installed' : '') : 'Not installed');
</script>

<template>
  <div :ref="(el) => { s.el = el as HTMLElement | null; }" class="agentlist">
    <RadioGroupRoot v-model="s.selected" class="rows" aria-label="Agents" :disabled="s.installing">
      <p v-if="s.looking" class="hint">Looking for agents on this computer…</p>
      <label v-for="a in s.agents" :key="a.id" class="agentrow" :class="{ account: !!a.account }" :data-agent="a.id">
        <RadioGroupItem v-if="list.choose" class="radio" :value="a.id"><RadioGroupIndicator /></RadioGroupItem>
        <span class="what"><b class="name">{{ a.account || !a.maker ? a.name : `${a.name} · ${a.maker}` }}</b><small class="needs">{{ needs(a) }}</small>
          <small class="where">{{ where(a) }}</small><small class="install-line">{{ installLine(a) }}</small></span>
        <a class="site" target="_blank" :href="list.details && a.site && !a.account ? a.site : undefined">Website</a>
        <span class="status">{{ status(a) }}</span>
        <button type="button" class="install" :hidden="a.installed || !a.install || !!a.account" :disabled="s.installing"
          @click.prevent="list.install(a.id)">Install</button>
        <button type="button" class="remove icon quiet" title="Remove this account: its folder goes, with its sign-in (asks first)"
          aria-label="Remove account" :hidden="!(list.details && a.account)" :disabled="s.installing" @click.prevent="list.remove(a.id)"><Icon name="i-close" /></button>
      </label>
    </RadioGroupRoot>
    <p class="progress hint">{{ s.progress }}</p>
    <CollapsibleRoot v-model:open="s.detailsOpen" class="details" :hidden="!s.showDetails" :unmount-on-hide="false">
      <CollapsibleTrigger class="more"><Icon name="i-down" />Details</CollapsibleTrigger><CollapsibleContent><pre>{{ s.log }}</pre></CollapsibleContent>
    </CollapsibleRoot>
    <p class="error">{{ s.error }}</p>
  </div>
</template>

<style>
.agentlist {
  .agentrow { display: flex; gap: var(--inset); align-items: center; padding: var(--inset) 4px; border-bottom: 1px solid var(--island-hi);
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    small { color: var(--text-muted); }
    :is(.install-line, .where) { font-family: "JetBrains Mono", monospace; overflow-wrap: anywhere; &:empty { display: none; } }
    /* Choosing: what Install runs only for the chosen one */
    &:has([role="radio"][data-state="unchecked"]) .install-line { display: none; }
    .site { color: var(--text-muted); white-space: nowrap; &:hover { color: var(--text); } &:not([href]) { display: none; } }
    .status { color: var(--text-muted); white-space: nowrap; }
    /* An account of the agent above it, set in under it */
    &.account { padding-inline-start: 28px; } }
  .progress { margin: 10px 0 0; &:empty { display: none; } }
  .details { margin-top: 6px; &[hidden] { display: none; }
    .more { display: flex; align-items: center; gap: 4px; height: auto; padding: 0; border: none; background: none; color: var(--text-muted);
      &:hover { color: var(--text); } svg { rotate: -90deg; } &[data-state="open"] svg { rotate: none; } } }
  pre { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 8px; border-radius: var(--radius); background: var(--window);
    font: 12px "JetBrains Mono", monospace; white-space: pre-wrap; user-select: text; }
}
</style>
