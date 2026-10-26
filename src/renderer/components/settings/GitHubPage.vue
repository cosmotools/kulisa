<script setup lang="ts">
// Settings → GitHub (src/github/README.md, The window): the GitHub accounts, a list as an agent's accounts are; Add
// Account with Kulisa App (the device flow: Kulisa shows GitHub's code itself) or with a fine-grained token; Sign in
// Again; Delete. Read when shown, not as Settings opens: where Kulisa App is installed is asked of GitHub.
import { computed, nextTick, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { focusAfterMenu, type MenuItem } from '../../lib/menu';
import { refused } from '../../../shared/result';
import { NEW_TOKEN } from '../../../github/ipc';
import type { GitHubAccount, GitHubInfo } from '../../../github/ipc';
import { MinusIcon, PlusIcon, TriangleAlertIcon } from '@lucide/vue';

const props = defineProps<{ shown: boolean }>();
const accounts = ref<GitHubAccount[]>([]), kept = ref(true), loaded = ref(false), error = ref('');
const sel = ref<string>();
// Signing in with Kulisa App: the code GitHub gave, until it is entered (again: the account signed in again).
const signing = ref<{ again: string | null; code: string; url: string } | null>(null);
// A token being pasted (again: the account it is a new token for).
const pasting = ref<{ again: string | null } | null>(null), token = ref(''), tokenField = ref<{ $el: HTMLInputElement }>(), copied = ref(false);
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
  focusAfterMenu(tokenField.value?.$el);
}
async function addToken() {
  if (!token.value.trim()) return tokenField.value!.$el.focus();
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
  <div id="githubpage" class="flex flex-col gap-4">
    <Alert v-if="!kept" id="ghnokeyring"><TriangleAlertIcon /><AlertDescription>This computer has no keyring, so sign-ins are not kept: you sign in again after Kulisa restarts.</AlertDescription></Alert>
    <Card id="ghaccounts">
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>Your GitHub accounts, for your agents' work on GitHub. Each repository of a project goes as one of them (its row on the project's page).</CardDescription>
        <CardAction>
          <ButtonMenu :items="addMenu"><Button id="ghadd" variant="ghost" size="icon-sm" title="Add an account" aria-label="Add an account" :disabled="busy"><PlusIcon /></Button></ButtonMenu>
          <Button id="ghdel" variant="ghost" size="icon-sm" title="Delete the account (asks first)" aria-label="Delete the account" :disabled="!sel" @click="remove()"><MinusIcon /></Button>
        </CardAction>
      </CardHeader>
      <!-- The menu around all of it: the list is there only with rows, and a row added later would get none -->
      <RightClickMenu :items="rowMenu">
        <CardContent>
          <ListboxRoot v-if="accounts.length" v-model="sel" selection-behavior="replace" aria-label="GitHub accounts" @keydown.delete="remove()">
            <ListboxContent as-child>
              <ItemGroup>
                <ListboxItem v-for="a in accounts" :key="a.id" :value="a.id" as-child>
                  <Item size="xs" class="data-[state=checked]:bg-muted" :data-github="a.id" :aria-label="a.login">
                    <ItemContent class="min-w-0">
                      <ItemTitle class="max-w-full truncate" :title="a.login">{{ a.login }}</ItemTitle>
                      <ItemDescription class="truncate" :title="`Kulisa App on ${installedText(a)}; ${projectsText(a)}`">
                        <span data-testid="installed">{{ installedText(a) }}</span> · <span data-testid="projects">{{ projectsText(a) }}</span></ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge v-if="!a.signedIn" variant="destructive" title="Sign in Again: its right-click">signed out</Badge>
                      <span v-else class="text-xs text-muted-foreground" data-testid="ends">{{ endText(a) }}</span>
                    </ItemActions>
                  </Item>
                </ListboxItem>
              </ItemGroup>
            </ListboxContent>
          </ListboxRoot>
          <Empty v-if="loaded && !accounts.length" class="p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">No accounts yet.</EmptyTitle></Empty>
        </CardContent>
      </RightClickMenu>
    </Card>

    <Card v-if="signing" id="ghsignin">
      <CardHeader>
        <CardTitle>Enter this code on GitHub</CardTitle>
        <CardDescription>On GitHub's page, which opened in your browser (<a :href="signing.url" target="_blank">open it again</a>).</CardDescription>
      </CardHeader>
      <!-- GitHub's code in the terminal's font, its letters apart: read and typed without a mistake (0 and O) -->
      <CardContent class="flex flex-col gap-3">
        <output id="ghcode" class="font-mono text-2xl font-semibold tracking-widest select-text">{{ signing.code }}</output>
        <FieldDescription>Enter a code on GitHub only when Kulisa has just shown it to you: a code someone else gives you signs them in as you.</FieldDescription>
      </CardContent>
      <CardFooter class="gap-2">
        <Button id="ghcopy" variant="outline" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</Button>
        <Button id="ghsignincancel" variant="outline" @click="cancelSignin">Cancel</Button>
      </CardFooter>
    </Card>
    <Card v-if="pasting" id="ghtokenadd">
      <CardHeader>
        <CardTitle><label for="ghtoken">A fine-grained token</label></CardTitle>
        <CardDescription><a :href="NEW_TOKEN" target="_blank">Make one on GitHub</a>, its resource owner the organization or user of your repositories (an
          organization may have to approve it), then paste it here.</CardDescription>
      </CardHeader>
      <!-- Enter adds it; Esc puts it away -->
      <CardContent class="flex gap-2">
        <Input id="ghtoken" ref="tokenField" v-model="token" type="password" placeholder="github_pat_…" aria-label="Token" spellcheck="false"
               @input="error = ''" @keydown.enter.prevent="addToken" @keydown.esc.stop.prevent="pasting = null" />
        <Button variant="outline" @click="pasting = null">Cancel</Button>
        <Button id="ghtokensave" @click="addToken">Add</Button>
      </CardContent>
    </Card>
    <FieldError id="gherror" class="empty:hidden">{{ error }}</FieldError>
  </div>
</template>
