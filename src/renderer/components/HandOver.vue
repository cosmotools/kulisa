<script setup lang="ts">
// Change Agent: the task handed to another agent (docs/tasks.md, Several agents in a task). What goes along is drawn between the
// two, and flies over to the new one while it reads the conversation (task_history: handover:read, its real progress);
// its tab, in front under the dialog, is shown once it has read it all, or at once when it needs the human or stops
// reading: a dialog that never waits for an agent waiting for the human. Show now any time.
import { computed, ref, watch } from 'vue';
import { Avatar, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Modal from './Modal.vue';
import { act, store, shownTask } from '../lib/store';
import { agentMark } from '../lib/agents';
import { avatarSrc } from '../lib/common';
import { registerDialog } from '../lib/dialogs';
import type { Terminal } from '../../shared/types';
import { refused } from '../../shared/result';
import { BookOpenIcon, GitBranchIcon, GlobeIcon, SquareTerminalIcon } from '@lucide/vue';

const modal = ref<InstanceType<typeof Modal>>();
const from = ref<Terminal | null>(null), chosen = ref<string>(), going = ref(false);
// The new agent's tab once open, what it has read, the task it is in; an error opening it.
const handed = ref<number | null>(null), read = ref<{ part: number; parts: number } | null>(null), error = ref('');
let inTask: string | null = null, idle = 0;
const IDLE = 30_000; // no part read for this long: an agent that thinks before it reads, or never does
const agents = computed(() => (store.projects.open.find((o) => o.id === store.projects.project)?.agents || []).filter((a) => a.cli !== 'shell'));
const to = computed(() => agents.value.find((a) => a.id === chosen.value));
// "Claude Code · me@x.com": the agent, then its account.
const parts = (name: string) => { const [agent, ...account] = name.split(' · '); return { agent, account: account.join(' · ') }; };
const branch = computed(() => shownTask()?.branch);
const tabs = computed(() => store.profiles.reduce((n, p) => n + p.tabs.length, 0));
const shells = computed(() => store.terminals.list.filter((t) => !t.agent));
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
// What goes along, while it reads: flying over one after the other (their animation-delay)
const chip = computed(() => ['relative bg-background', going.value && 'motion-safe:animate-[handed_1.6s_ease-in_infinite]']);

registerDialog('handover', {
  async open(t) {
    from.value = t; going.value = false; handed.value = null; read.value = null; error.value = '';
    // Another agent first (the reason to hand over is most often this one's limit), else another account, else the same.
    const list = agents.value, cli = t.agent!.cli;
    chosen.value = (list.find((a) => a.cli !== cli) || list.find((a) => a.id !== t.agent!.account) || list[0])?.id;
    await modal.value!.open();
  },
});
async function hand() {
  if (!from.value || !chosen.value || going.value) return;
  going.value = true; inTask = store.current;
  const r = await act('agent:hand-over', { id: from.value.id, agent: chosen.value });
  if (!going.value) return; // closed meanwhile: the tab is there, behind
  if (refused(r)) { going.value = false; error.value = r.error || 'The agent did not start.'; return; }
  handed.value = r.id;
  waitIdle();
}
const waitIdle = () => { clearTimeout(idle); idle = window.setTimeout(show, IDLE); };
// Its tab shown (in front again, if the human chose another meanwhile), the dialog closed: once it has read it all, or
// the human does not wait (Show now, ×).
function show() {
  clearTimeout(idle);
  if (handed.value !== null && store.current === inTask) void act('terminal:show', { id: handed.value });
  handed.value = null; going.value = false;
  modal.value?.close();
}
kulisa.on('handover:read', ({ task, id, part, parts }) => {
  if (task !== inTask || id !== handed.value) return;
  read.value = { part, parts };
  if (part >= parts) show(); else waitIdle();
});
// It needs the human (a permission, a sign-in, a limit: its hooks say it waits), or its tab is gone.
watch(() => { const t = store.terminals.list.find((x) => x.id === handed.value); return handed.value === null ? 'none' : t ? t.state : 'gone'; },
  (s) => { if (s === 'waiting' || (s === 'gone' && store.current === inTask)) show(); });
const progress = computed(() => {
  if (!going.value || !to.value) return '';
  const who = parts(to.value.name).agent;
  return read.value ? `${who} is reading “${from.value?.name}”: part ${read.value.part} of ${read.value.parts}` : `${who} is starting…`;
});
</script>

<template>
  <Modal id="handover" ref="modal" title="Change Agent" class="sm:max-w-xl" @close="going && show()">
    <div v-if="from" class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-muted/50 p-4">
      <div class="flex min-w-0 flex-col items-center gap-0.5 text-center">
        <component :is="agentMark(from.agent!.cli)!" class="mb-1.5 size-10" />
        <span class="font-medium">{{ parts(from.agent!.name).agent }}</span>
        <span class="max-w-full truncate text-xs text-muted-foreground">{{ parts(from.agent!.name).account }}</span>
        <span class="max-w-full truncate text-xs text-muted-foreground">“{{ from.name }}”</span>
      </div>
      <!-- The way they go: a line from one agent to the other, under them; while it reads, the new agent takes in what flies over -->
      <ul class="relative flex flex-col gap-1 px-3 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-dashed" aria-label="Goes along">
        <Badge v-if="branch" as="li" variant="outline" :class="chip" :title="`branch ${branch}`"><GitBranchIcon />{{ branch }}</Badge>
        <Badge v-if="store.profiles.length" as="li" variant="outline" :class="chip" style="animation-delay: 120ms">
          <AvatarGroup><Avatar v-for="p in store.profiles" :key="p.id" size="sm" class="size-4" :title="p.name"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar></AvatarGroup>
          {{ plural(store.profiles.length, 'profile') }}, signed in
        </Badge>
        <Badge v-if="tabs" as="li" variant="outline" :class="chip" style="animation-delay: 240ms"><GlobeIcon />{{ plural(tabs, 'tab') }}</Badge>
        <Badge v-if="shells.length" as="li" variant="outline" :class="chip" style="animation-delay: 360ms"><SquareTerminalIcon />{{ shells.length === 1 ? shells[0]!.name : plural(shells.length, 'terminal') }}, running</Badge>
        <Badge as="li" variant="outline" :class="chip" style="animation-delay: 480ms"><BookOpenIcon />the whole conversation</Badge>
      </ul>
      <div class="flex min-w-0 flex-col items-center gap-0.5 text-center">
        <component :is="agentMark(to.cli)!" v-if="to" class="mb-1.5 size-10" :class="{ 'motion-safe:animate-[received_1.6s_ease-out_.5s_infinite]': going }" />
        <span class="font-medium">{{ to ? parts(to.name).agent : '' }}</span>
        <span class="max-w-full truncate text-xs text-muted-foreground">{{ to ? parts(to.name).account : '' }}</span>
        <span class="max-w-full truncate text-xs text-muted-foreground">a new tab</span>
      </div>
    </div>
    <RadioGroup v-model="chosen" class="mb-4" aria-label="Agent" :disabled="going">
      <div v-for="a in agents" :key="a.id" class="flex items-center gap-3" :data-agent="a.id">
        <Label class="flex-1"><RadioGroupItem :value="a.id" /><component :is="agentMark(a.cli)!" class="size-4" />{{ a.name }}</Label>
        <span v-if="a.id === from?.agent?.account" class="text-muted-foreground">this one, afresh</span>
      </div>
    </RadioGroup>
    <p class="mb-4 text-center" role="status" :hidden="!going">{{ progress }}</p>
    <p class="mb-4 text-destructive select-text empty:hidden">{{ error }}</p>
    <p class="text-muted-foreground" :hidden="going">It reads this conversation first, then tells you in a few lines what is done and what is
      next. Its own hidden reasoning, permissions given and its account's settings stay behind. This tab stays until you close it.</p>
    <template #footer>
      <DialogClose v-if="!going" as-child><Button variant="outline">Cancel</Button></DialogClose>
      <Button v-if="going" id="handovershow" @click="show">Show now</Button>
      <Button v-else id="handoverstart" :disabled="!chosen" @click="hand">Hand over</Button>
    </template>
  </Modal>
</template>

<style>
@keyframes handed { 55% { translate: 160px 0; scale: .6; opacity: 0; } 56% { translate: 0; scale: 1; opacity: 0; } 80% { opacity: 1; } }
@keyframes received { 30% { scale: 1.15; } 60% { scale: 1; } }
</style>
