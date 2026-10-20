<script setup lang="ts">
// New Project's second step: its team (docs/tasks.md, The team), a role ready with the first account, the roles'
// editor under it, then a new account of Claude Code or Codex (wizard.ts has the rules). In the welcome, over it, the
// idea in a small scene (TeamScene.vue).
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import AccountSignIn from '../AccountSignIn.vue';
import InstallProgress from '../InstallProgress.vue';
import TeamScene from './TeamScene.vue';
import { agentMark } from '../../lib/agents';
import { useWizard } from './wizard';
import type { MenuItem } from '../../lib/menu';

const w = useWizard();
const account = (id: string) => w.accounts.value.find((a) => a.id === id);
const accountName = (id: string) => { const a = account(id); return a ? `${a.name} · ${a.email || a.id}` : id; };
const addMenu = (): MenuItem[] => [{ heading: 'Played by' }, ...w.accounts.value.map((a) => ({ label: accountName(a.id), icon: agentMark(a.agent)!, run: () => w.addRole(a.id) }))];
</script>

<template>
  <div id="npagentstep" class="npstep">
    <TeamScene v-if="w.single" />
    <p class="hint">{{ w.single ? 'Go on with one agent, or give the task a team: each role an account and what it does.'
      : 'Who works in its tasks: roles, each an agent\'s account and what it does (a new task starts the default one; the others open beside it). Change it any time in Settings.' }}</p>
    <div id="npagents">
      <div v-for="r in w.roles.value" :key="r.key" class="nprole" :data-account="r.account">
        <span class="who" :title="accountName(r.account)"><Icon v-if="account(r.account)" :name="agentMark(account(r.account)!.agent)!" />{{ accountName(r.account) }}</span>
        <input v-model="r.role" class="rolename" maxlength="40" spellcheck="false" placeholder="Role (optional): Builder, Checker…" aria-label="Role">
        <button type="button" class="icon small" :class="{ quiet: !w.isDefault(r.key) }" :aria-pressed="w.isDefault(r.key)"
          :title="w.isDefault(r.key) ? 'The default: a new task starts it' : 'Make Default'" aria-label="Default" @click="w.main.value = r.key">
          <Icon name="i-star" /></button>
        <button type="button" class="icon small quiet" title="Leave out" aria-label="Leave out" @click="w.removeRole(r.key)"><Icon name="i-close" /></button>
        <input v-model="r.about" class="roleabout" maxlength="500" placeholder="What it does, in your words (optional): checks every change and reports bugs to the builder"
          aria-label="What it does">
      </div>
      <p v-if="!w.roles.value.length" class="empty">No accounts yet: add one below, or go on without (a task then starts with a terminal).</p>
      <ButtonMenu v-if="w.accounts.value.length" :items="addMenu"><button id="nproleadd" type="button" class="add"><Icon name="i-plus" />Add role</button></ButtonMenu>
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
  #npagents { display: grid; gap: var(--inset); }
  /* a role: who plays it, its name, the default's ★ and ×; what it does on a line of its own under them */
  .nprole { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 12em) auto auto; align-items: center; gap: var(--inset);
    .who { display: flex; align-items: center; gap: var(--inset); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      svg { width: 16px; height: 16px; flex: none; } }
    .roleabout { grid-column: 1 / -1; } }
  .add { justify-self: start; display: inline-flex; align-items: center; gap: 6px; svg { width: 14px; height: 14px; } }
  .npnew { display: flex; flex-wrap: wrap; gap: var(--gap); button { display: inline-flex; align-items: center; gap: 6px; svg { width: 16px; height: 16px; } } }
}
</style>
