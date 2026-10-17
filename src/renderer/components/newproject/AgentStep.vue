<script setup lang="ts">
// New Project's second step: its agents, the accounts there are first, then a new one of Claude Code or Codex
// (wizard.ts has the rules).
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import AccountSignIn from '../AccountSignIn.vue';
import InstallProgress from '../InstallProgress.vue';
import { agentMark } from '../../lib/agents';
import { useWizard } from './wizard';
import type { Account } from '../../../shared/types';

const w = useWizard();
const accountName = (a: Account) => `${a.name} · ${a.email || a.id}`;
</script>

<template>
  <div id="npagentstep" class="npstep">
    <p class="hint">Who works in its tasks: agents signed in to your accounts, one or several (a new task starts the
      default one; the others open beside it). Change it any time in Settings.</p>
    <div id="npagents">
      <div v-for="a in w.accounts.value" :key="a.id" class="nprow" :data-account="a.id">
        <label class="nprow"><CheckboxRoot class="checkbox" :model-value="w.chosen.value.includes(a.id)" @update:model-value="(on) => w.choose(a.id, !!on)">
          <CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot>
          <Icon :name="agentMark(a.agent)!" /><span>{{ accountName(a) }}</span></label>
        <template v-if="w.chosen.value.includes(a.id)">
          <button type="button" class="icon small" :class="{ quiet: !w.isDefault(a.id) }" :aria-pressed="w.isDefault(a.id)"
            :title="w.isDefault(a.id) ? 'The default: a new task starts it' : 'Make Default'" aria-label="Default" @click="w.main.value = a.id">
            <Icon name="i-star" /></button>
          <kbd v-if="w.isDefault(a.id)" class="default">default</kbd>
        </template>
      </div>
      <p v-if="!w.accounts.value.length" class="empty">No accounts yet: add one below, or go on without (a task then starts with a terminal).</p>
    </div>
    <h3 class="titled">Add account</h3>
    <AccountSignIn v-if="w.signing.value" :agent="w.signing.value" @done="w.signedIn" @close="w.signing.value = null" />
    <template v-else>
      <div class="npnew">
        <button v-for="a in w.addable.value" :key="a.id" type="button" :data-add="a.id" :disabled="w.installs.state.installing || (!a.installed && !a.install)"
          :title="a.installed ? `Sign in to an account of ${a.name}` : `${a.name} is installed first (its maker's installer), then you sign in`"
          @click="w.addAccount(a)"><Icon :name="agentMark(a.id)!" />{{ a.name }}</button>
      </div>
      <InstallProgress :list="w.installs" />
    </template>
  </div>
</template>

<style>
#npagentstep {
  .nprow { display: flex; align-items: center; gap: var(--inset); min-height: var(--row);
    svg { width: 16px; height: 16px; } kbd { font: inherit; font-size: var(--font-small); color: var(--text-muted); } }
  .npnew { display: flex; flex-wrap: wrap; gap: var(--gap); button { display: inline-flex; align-items: center; gap: 6px; svg { width: 16px; height: 16px; } } }
}
</style>
