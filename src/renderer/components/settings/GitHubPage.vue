<script setup lang="ts">
// Settings → GitHub (src/github/README.md, The window): the GitHub accounts, a .list as an agent's accounts are; Add
// Account with Kulisa App (the device flow: Kulisa shows GitHub's code itself) or with a fine-grained token; Sign in
// Again; Delete. Read when shown, not as Settings opens: where Kulisa App is installed is asked of GitHub.
import { computed, nextTick, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { focusAfterMenu, type MenuItem } from '../../lib/menu';
import { refused } from '../../../shared/result';
import { NEW_TOKEN } from '../../../github/ipc';
import type { GitHubAccount, GitHubInfo } from '../../../github/ipc';

const props = defineProps<{ shown: boolean }>();
const accounts = ref<GitHubAccount[]>([]), kept = ref(true), loaded = ref(false), error = ref('');
const sel = ref<string>();
// Signing in with Kulisa App: the code GitHub gave, until it is entered (again: the account signed in again).
const signing = ref<{ again: string | null; code: string; url: string } | null>(null);
// A token being pasted (again: the account it is a new token for).
const pasting = ref<{ again: string | null } | null>(null), token = ref(''), tokenField = ref<HTMLInputElement>(), copied = ref(false);
const show = (r: GitHubInfo) => { accounts.value = r.accounts; kept.value = r.kept; loaded.value = true; };
// Again each time it is shown: an account's projects and sign-in change elsewhere (a project's page, a refresh).
watch(() => props.shown, async (s) => { if (s) show(await kulisa.invoke('github:accounts')); }, { immediate: true });

const busy = computed(() => !!signing.value || !!pasting.value);
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const installedText = (a: GitHubAccount) => (a.kind === 'pat' ? 'a token' : a.installed === null ? '—' : a.installed.join(', ') || 'nowhere yet');
const projectsText = (a: GitHubAccount) => (a.projects.length ? `in ${a.projects.join(', ')}` : 'in no project');
const endText = (a: GitHubAccount) => (a.ends === null ? 'no end' : `until ${day(a.ends)}`);

async function withGitHub(again: string | null = null) {
  error.value = ''; pasting.value = null;
  const r = await kulisa.invoke('github:signin', { again });
  if (refused(r)) { error.value = r.error; return; }
  signing.value = { again, ...r }; copied.value = false;
  const done = await kulisa.invoke('github:signin-wait');
  if (signing.value?.code !== r.code) return; // cancelled, or another begun
  signing.value = null;
  if (refused(done)) { error.value = done.error ?? ''; return; }
  show(done); sel.value = done.id;
}
async function cancelSignin() { signing.value = null; await kulisa.invoke('github:signin-cancel'); }
async function copy() { if (signing.value) { await navigator.clipboard.writeText(signing.value.code); copied.value = true; } }
async function withToken(again: string | null = null) {
  if (signing.value) await cancelSignin();
  error.value = ''; token.value = ''; pasting.value = { again };
  await nextTick();
  focusAfterMenu(tokenField.value);
}
async function addToken() {
  if (!token.value.trim()) return tokenField.value!.focus();
  const r = await kulisa.invoke('github:token', { token: token.value, again: pasting.value?.again ?? null });
  if (refused(r)) { error.value = r.error; return; }
  pasting.value = null; token.value = ''; show(r); sel.value = r.id;
}
const again = (a: GitHubAccount) => (a.kind === 'app' ? withGitHub(a.id) : withToken(a.id));
async function remove(id = sel.value) {
  if (!id) return;
  error.value = '';
  const r = await kulisa.invoke('github:delete', { id });
  if (refused(r)) { error.value = r.error ?? ''; return; } // null: the human said no
  show(r);
  if (!r.accounts.some((x) => x.id === sel.value)) sel.value = undefined;
}
const addMenu = (): MenuItem[] => [{ heading: 'Add Account' }, { label: 'With GitHub…', sub: 'Kulisa App, on the repositories you install it on', run: () => withGitHub() },
  { label: 'With a Token…', sub: 'a fine-grained token, where Kulisa App is not installed', run: () => withToken() }];
const rowMenu = (e: MouseEvent): MenuItem[] | null => {
  const id = (e.target as Element).closest<HTMLElement>('[data-github]')?.dataset.github, a = accounts.value.find((x) => x.id === id);
  if (!a) return null;
  sel.value = a.id;
  return [{ label: 'Sign in Again…', enabled: !busy.value, run: () => again(a) }, { label: 'Delete…', run: () => remove(a.id) }];
};
</script>

<template>
  <div id="githubpage">
    <p class="hint">Your GitHub accounts, for your agents' work on GitHub. Each repository of a project goes as one of them (its row on the project's page).</p>
    <p v-if="!kept" id="ghnokeyring" class="hint warn">This computer has no keyring, so sign-ins are not kept: you sign in again after Kulisa restarts.</p>
    <h3 class="titled">Accounts</h3>
    <RightClickMenu :items="rowMenu">
      <div id="ghaccounts" class="list">
        <div class="tools">
          <ButtonMenu :items="addMenu"><button id="ghadd" class="icon small" type="button" title="Add an account" aria-label="Add an account" :disabled="busy"><Icon name="i-plus" /></button></ButtonMenu>
          <button id="ghdel" class="icon small" type="button" title="Delete the account (asks first)" aria-label="Delete the account" :disabled="!sel" @click="remove()"><Icon name="i-minus" /></button>
        </div>
        <div v-if="accounts.length" class="head" aria-hidden="true"><span>Account</span><span>Kulisa App on</span><span>Projects</span><span>Signed in</span></div>
        <ListboxRoot v-if="accounts.length" v-model="sel" selection-behavior="replace" aria-label="GitHub accounts" @keydown.delete="remove()">
          <ListboxContent>
            <ListboxItem v-for="a in accounts" :key="a.id" :value="a.id" class="item" :data-github="a.id">
              <span class="cell label" :title="a.login">{{ a.login }}</span>
              <small class="cell installed" :title="installedText(a)">{{ installedText(a) }}</small>
              <small class="cell projects" :title="projectsText(a)">{{ projectsText(a) }}</small>
              <span class="cell end"><kbd v-if="!a.signedIn" class="warn" title="Sign in Again: its right-click">signed out</kbd><small v-else class="ends">{{ endText(a) }}</small></span>
            </ListboxItem>
          </ListboxContent>
        </ListboxRoot>
        <p v-if="loaded && !accounts.length" class="empty">No accounts yet.</p>
      </div>
    </RightClickMenu>

    <div v-if="signing" id="ghsignin">
      <p class="hint">Enter this code on GitHub's page, which opened in your browser (<a :href="signing.url" target="_blank">open it again</a>):</p>
      <div class="row"><output id="ghcode">{{ signing.code }}</output>
        <button id="ghcopy" type="button" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        <button id="ghsignincancel" type="button" @click="cancelSignin">Cancel</button></div>
      <p class="hint">Enter a code on GitHub only when Kulisa has just shown it to you: a code someone else gives you signs them in as you.</p>
    </div>
    <div v-if="pasting" id="ghtokenadd">
      <p class="hint">A fine-grained token: <a :href="NEW_TOKEN" target="_blank">make one on GitHub</a>, its resource owner the organization or
        user of your repositories (an organization may have to approve it), then paste it here.</p>
      <!-- Enter adds it; Esc puts it away -->
      <div class="row"><input id="ghtoken" ref="tokenField" v-model="token" type="password" placeholder="github_pat_…" aria-label="Token" spellcheck="false"
        @input="error = ''" @keydown.enter.prevent="addToken" @keydown.esc.stop.prevent="pasting = null">
        <button type="button" @click="pasting = null">Cancel</button>
        <button id="ghtokensave" class="primary" type="button" @click="addToken">Add</button></div>
    </div>
    <p id="gherror" class="error">{{ error }}</p>
  </div>
</template>

<style>
#githubpage { display: flex; flex-direction: column; gap: var(--gap);
  > .hint, :is(#ghsignin, #ghtokenadd) .hint { margin: 0; } .warn { color: var(--note); }
  .list { --cols: fit-content(30%) minmax(0, 1fr) minmax(0, 1fr) auto; } /* the login, where the App is, its projects, its end */
  :is(#ghsignin, #ghtokenadd) { display: flex; flex-direction: column; gap: var(--gap); .row { margin: 0; align-items: center; } }
  /* GitHub's code in the terminal's font, its letters apart: read and typed without a mistake (0 and O) */
  #ghcode { font: 600 var(--font) "JetBrains Mono", monospace; letter-spacing: 0.1em; color: var(--text-strong); user-select: text; margin-inline-end: var(--gap); }
  .error { margin: 0; }
}
</style>
