<script setup lang="ts">
// An agent's page in Settings (tasks.md, "Choosing the agent", Accounts), as JetBrains' SDKs: who makes it, where it is,
// Install, and its accounts. The list's state (lib/agents.ts) lives with Settings, so an install goes on while
// a project is shown. Every agent's details are in the page, the chosen one's shown: a few agents, and an install's
// row keeps its state as another is looked at.
import { computed, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { FieldError } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import AccountSignIn from '../AccountSignIn.vue';
import InstallProgress from '../InstallProgress.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import type { MenuItem } from '../../lib/menu';
import { shortPath, type Agent, type AgentList as List } from '../../lib/agents';
import type { Account, AccountsInfo, SignedIn } from '../../../shared/types';
import { refused } from '../../../shared/result';
import { MinusIcon, PlusIcon } from '@lucide/vue';

const props = defineProps<{ list: List; chosen?: string; accounts: Account[]; clis: string[] }>();
const emit = defineEmits<{ accounts: [r: Partial<AccountsInfo>] }>();
const s = props.list.state;
const error = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const accountSel = ref<string>();
watch(() => props.chosen, () => { accountSel.value = undefined; error.value = ''; });

const short = (p: string) => shortPath(p, s.home);
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
  <div :ref="(el) => { s.el = el as HTMLElement | null; }" id="agentpage" class="flex flex-col gap-4">
    <section v-for="a in s.agents" v-show="a.id === chosen" :key="a.id" class="flex flex-col gap-4" :data-agent="a.id">
      <Card>
        <CardHeader>
          <CardTitle role="status" data-testid="agent-status">{{ status(a) }}</CardTitle>
          <CardDescription class="font-mono break-all empty:hidden" data-testid="agent-where">{{ where(a) }}</CardDescription>
          <CardAction><Button :hidden="a.installed || !a.install" data-testid="install" :disabled="s.installing" @click="list.install(a.id)">Install</Button></CardAction>
        </CardHeader>
        <CardContent class="flex flex-col gap-1 text-muted-foreground">
          <p>Maker: <span class="text-foreground">{{ a.maker || '—' }}</span><template v-if="a.site"> · <a target="_blank" :href="a.site" data-testid="site">Website</a></template></p>
          <p v-if="a.needs">Needs: <span class="text-foreground" data-testid="needs">{{ a.needs }}</span></p>
          <p class="font-mono text-xs break-all empty:hidden" data-testid="install-line">{{ installLine(a) }}</p>
        </CardContent>
      </Card>

      <Card v-if="canSign(a)" :data-accounts="a.id">
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardAction>
            <Button variant="ghost" size="icon-sm" data-testid="accountnew" title="New Account…: signed in with its own sign-in" aria-label="New Account"
                    :disabled="!a.installed || busy" @click="newAccount(a)"><PlusIcon /></Button>
            <Button variant="ghost" size="icon-sm" data-testid="accountdel" title="Delete the account (asks first)" aria-label="Delete the account"
                    :disabled="!accountSel || !of(a).some((x) => x.id === accountSel)" @click="remove()"><MinusIcon /></Button>
          </CardAction>
        </CardHeader>
        <!-- The menu around all of it: the list is there only with rows, and a row added later would get none -->
        <RightClickMenu :items="accountMenu">
          <CardContent class="flex flex-col gap-3">
            <ListboxRoot v-if="of(a).length" v-model="accountSel" selection-behavior="replace" aria-label="Accounts" @keydown.delete="remove()">
              <ListboxContent as-child>
                <ItemGroup>
                  <ListboxItem v-for="x in of(a)" :key="x.id" :value="x.id" as-child>
                    <Item size="xs" class="data-[state=checked]:bg-muted" :data-account="x.id" :aria-label="x.email || x.id">
                      <ItemContent class="min-w-0">
                        <ItemTitle class="max-w-full truncate" :title="x.email || x.id">{{ x.email || x.id }}</ItemTitle>
                        <ItemDescription class="truncate" :title="projectsOf(x)">{{ projectsOf(x) }}</ItemDescription>
                      </ItemContent>
                    </Item>
                  </ListboxItem>
                </ItemGroup>
              </ListboxContent>
            </ListboxRoot>
            <Empty v-if="!of(a).length" class="p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">No accounts yet.</EmptyTitle></Empty>
            <AccountSignIn v-if="signing?.id === a.id" :agent="signing" @done="signedIn" @close="signing = null" />
          </CardContent>
        </RightClickMenu>
      </Card>
    </section>
    <p v-if="s.looking" class="text-muted-foreground">Looking for agents on this computer…</p>
    <InstallProgress :list />
    <FieldError id="agentpageerror" class="empty:hidden">{{ error }}</FieldError>
  </div>
</template>
