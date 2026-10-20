<script setup lang="ts">
// Settings → GitHub (src/github/README.md): the GitHub accounts, as an agent's page lists its accounts; Add Account…
// signs in with Kulisa App (a code entered on GitHub, in the human's own browser), or with a fine-grained token pasted.
import { ref, watch } from 'vue';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { refused } from '../../../shared/result';
import type { MenuItem } from '../../lib/menu';
import type { GithubAccount, GithubAccounts } from '../../../github/ipc';

const props = defineProps<{ shown: boolean }>();
const accounts = ref<GithubAccount[]>([]), install = ref(''), sel = ref<string>(), error = ref('');
const signing = ref(''), code = ref<{ code: string; url: string } | null>(null), token = ref(''), tokenOpen = ref(false), copied = ref(false);
const show = (r: GithubAccounts) => { accounts.value = r.accounts; install.value = r.install; if (!r.accounts.some((a) => a.id === sel.value)) sel.value = undefined; };
// Each time it is shown: as stored at once, then as GitHub says now (what each reaches, signed out on GitHub), the
// projects using each as they are now.
watch(() => props.shown, async (shown) => { if (shown) { show(await kulisa.invoke('github:accounts')); show(await kulisa.invoke('github:refresh')); } }, { immediate: true });

const reach = (a: GithubAccount) => (a.repos.length === 1 ? a.repos[0]! : `${a.repos.length} repositories`);
const reachAll = (a: GithubAccount) => a.repos.join('\n') || 'No repository yet';
const used = (a: GithubAccount) => (a.projects.length ? `in ${a.projects.join(', ')}` : 'in no project');
const ends = (a: GithubAccount) => (a.ends && a.via === 'token' ? `Its token ends on ${new Date(a.ends).toLocaleDateString()}` : '');

let n = 0;
kulisa.on('github:code', (c) => { if (c.key === signing.value) code.value = c; });
// Add Account… and Sign In Again: the same sign-in, the account GitHub signs in to replacing its old sign-in.
async function signIn() {
  error.value = ''; code.value = null; copied.value = false; tokenOpen.value = false;
  const key = signing.value = `github#${++n}`;
  const r = await kulisa.invoke('github:signin', { key });
  if (signing.value !== key) return;
  signing.value = ''; code.value = null;
  if (refused(r)) error.value = r.error ?? ''; else show(r);
}
async function cancel() {
  const key = signing.value;
  signing.value = ''; code.value = null; token.value = '';
  if (key) await kulisa.invoke('github:signin-cancel', { key });
}
// The code copied, and GitHub's page for it opened in the human's browser (the window opens links there).
async function openGithub() {
  await navigator.clipboard.writeText(code.value!.code);
  copied.value = true;
  window.open(code.value!.url, '_blank');
}
async function addToken() {
  error.value = '';
  const r = await kulisa.invoke('github:token', { token: token.value });
  if (refused(r)) { error.value = r.error; return; }
  token.value = '';
  await cancel();
  show(r);
}
async function remove(id = sel.value) {
  if (!id) return;
  error.value = '';
  const r = await kulisa.invoke('github:delete', { id });
  if (refused(r)) error.value = r.error ?? ''; else show(r);
}
const rowMenu = (e: MouseEvent): MenuItem[] | null => {
  const id = (e.target as Element).closest<HTMLElement>('[data-github]')?.dataset.github;
  if (!id) return null;
  sel.value = id;
  return [{ label: 'Sign In Again', enabled: !signing.value, run: signIn }, { label: 'Delete…', run: () => remove(id) }];
};
defineExpose({ signIn });
</script>

<template>
  <div id="githubpage">
    <p class="hint">The accounts the agents work with GitHub as: each repository of a project goes as one (its row in the
      project's Code). Kulisa keeps their sign-ins encrypted; the agents never see them.</p>
    <div class="list">
      <div class="tools">
        <button id="githubadd" class="icon small" type="button" title="Add Account…: signed in with Kulisa App on GitHub" aria-label="Add Account"
          :disabled="!!signing" @click="signIn"><Icon name="i-plus" /></button>
        <button id="githubdel" class="icon small" type="button" title="Delete the account (asks first)" aria-label="Delete the account" :disabled="!sel" @click="remove()"><Icon name="i-minus" /></button>
      </div>
      <div v-if="accounts.length" class="head" aria-hidden="true"><span>Account</span><span>Reaches</span><span>Projects</span><span /></div>
      <RightClickMenu :items="rowMenu">
        <ListboxRoot v-if="accounts.length" id="githubaccounts" v-model="sel" selection-behavior="replace" aria-label="GitHub accounts" @keydown.delete="remove()">
          <ListboxContent>
            <ListboxItem v-for="a in accounts" :key="a.id" :value="a.id" class="item" :data-github="a.id" :title="[a.name, ends(a)].filter(Boolean).join('\n')">
              <span class="cell label">{{ a.login }}</span><small class="cell" :title="reachAll(a)">{{ reach(a) }}</small><small class="cell" :title="used(a)">{{ used(a) }}</small>
              <span class="cell end"><kbd v-if="a.via === 'token'" title="Signed in with a fine-grained token">token</kbd>
                <kbd v-if="a.expired" class="warn" title="GitHub no longer takes its sign-in: Sign In Again (right-click)">signed out</kbd></span>
            </ListboxItem>
          </ListboxContent>
        </ListboxRoot>
      </RightClickMenu>
      <p v-if="!accounts.length" class="empty">No accounts yet.</p>
    </div>
    <p class="hint">Kulisa App reaches only the repositories you install it on. <a id="githubinstall" :href="install" target="_blank">Choose Repositories on GitHub</a></p>

    <div v-if="signing" id="githubsignin">
      <template v-if="code">
        <p class="hint">Enter this code on GitHub, in your browser, and authorize Kulisa App there:</p>
        <div class="row"><output id="githubcode" class="code">{{ code.code }}</output>
          <button id="githubopen" class="primary" type="button" @click="openGithub">{{ copied ? 'Copied: Open GitHub Again' : 'Copy Code and Open GitHub' }}</button></div>
        <p class="hint">Waiting for GitHub…</p>
      </template>
      <p v-else class="hint">Asking GitHub for a code…</p>
      <CollapsibleRoot v-model:open="tokenOpen">
        <CollapsibleTrigger class="disclose"><Icon name="i-down" />Use a Token Instead</CollapsibleTrigger>
        <CollapsibleContent>
          <p class="hint">For an organization that does not let Kulisa App in: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">make a
            fine-grained token</a> for its repositories (Contents: read; Pull requests, Issues: read and write; Checks, Commit statuses, Actions: read), and paste it here.</p>
          <div class="row"><input id="githubtoken" v-model="token" type="password" placeholder="github_pat_…" aria-label="Token" spellcheck="false" autocomplete="off"
            @keydown.enter.prevent="addToken">
            <button id="githubtokenadd" type="button" :disabled="!token.trim()" @click="addToken">Add</button></div>
        </CollapsibleContent>
      </CollapsibleRoot>
      <div class="row"><button id="githubcancel" type="button" @click="cancel">Cancel</button></div>
    </div>
    <p id="githuberror" class="error">{{ error }}</p>
  </div>
</template>

<style>
#githubpage { display: flex; flex-direction: column; gap: var(--gap);
  .list { --cols: fit-content(30%) minmax(0, 1fr) fit-content(30%) auto; } /* its login, what it reaches, its projects, its state */
  .hint, .error { margin: 0; } a { color: var(--accent); }
  #githubsignin { display: flex; flex-direction: column; gap: var(--gap); margin-top: var(--pad); .row { margin: 0; align-items: center; } }
  .code { font: 600 var(--font-lead) "JetBrains Mono", monospace; letter-spacing: .1em; color: var(--text-strong); user-select: text; }
  #githubtoken { flex: 1; }
}
</style>
