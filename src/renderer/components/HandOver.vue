<script setup lang="ts">
// Change Agent: the task handed to another agent (docs/tasks.md, Agents in a task). What goes along is drawn between the
// two, and flies over to the new one while it reads the conversation (task_history: handover:read, its real progress);
// its tab, in front under the dialog, is shown once it has read it all, or at once when it needs the human or stops
// reading: a dialog that never waits for an agent waiting for the human. Show now any time.
import { computed, ref, watch } from 'vue';
import { DialogClose, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import { act, store, shownTask } from '../lib/store';
import { agentMark } from '../lib/agents';
import { avatarSrc } from '../lib/common';
import { registerDialog } from '../lib/dialogs';
import type { Terminal } from '../types';

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
  const r = await act<{ id?: number; error?: string }>('agent:hand-over', { id: from.value.id, agent: chosen.value });
  if (!going.value) return; // closed meanwhile: the tab is there, behind
  if (r.id === undefined) { going.value = false; error.value = r.error || 'The agent did not start.'; return; }
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
kulisa.on<{ task: string; id: number; part: number; parts: number }>('handover:read', ({ task, id, part, parts }) => {
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
  <Modal id="handover" ref="modal" title="Change Agent" @close="going && show()">
    <div v-if="from" class="relay" :class="{ going }">
      <div class="side from">
        <Icon class="mark" :name="agentMark(from.agent!.cli)!" />
        <b>{{ parts(from.agent!.name).agent }}</b>
        <small>{{ parts(from.agent!.name).account }}</small>
        <small class="conv">“{{ from.name }}”</small>
      </div>
      <ul class="baton" aria-label="Goes along">
        <li v-if="branch" class="chip" style="--i: 0"><Icon name="i-git" />{{ branch }}</li>
        <li v-if="store.profiles.length" class="chip" style="--i: 1">
          <span class="faces"><img v-for="p in store.profiles" :key="p.key" class="avatar" alt="" :src="avatarSrc(p.avatar)" :title="p.name"></span>
          {{ plural(store.profiles.length, 'profile') }}, signed in
        </li>
        <li v-if="tabs" class="chip" style="--i: 2"><Icon name="i-globe" />{{ plural(tabs, 'tab') }}</li>
        <li v-if="shells.length" class="chip" style="--i: 3"><Icon name="i-agent-shell" />{{ shells.length === 1 ? shells[0]!.name : plural(shells.length, 'terminal') }}, running</li>
        <li class="chip" style="--i: 4"><Icon name="i-docs" />the whole conversation</li>
      </ul>
      <div class="side to">
        <Icon v-if="to" class="mark" :name="agentMark(to.cli)!" />
        <b>{{ to ? parts(to.name).agent : '' }}</b>
        <small>{{ to ? parts(to.name).account : '' }}</small>
        <small class="conv">a new tab</small>
      </div>
    </div>
    <RadioGroupRoot v-model="chosen" class="choose" aria-label="Agent" :disabled="going">
      <label v-for="a in agents" :key="a.id" class="item" :data-agent="a.id">
        <RadioGroupItem class="radio" :value="a.id"><RadioGroupIndicator /></RadioGroupItem>
        <Icon :name="agentMark(a.cli)!" /><span class="label">{{ a.name }}</span>
        <small v-if="a.id === from?.agent?.account">this one, afresh</small>
      </label>
    </RadioGroupRoot>
    <p class="progress" :hidden="!going">{{ progress }}</p>
    <p class="error">{{ error }}</p>
    <p class="hint" :hidden="going">It reads this conversation first, then tells you in a few lines what is done and what is next. Its own
      hidden reasoning, permissions given and its account's settings stay behind. This tab stays until you close it.</p>
    <template #footer>
      <DialogClose v-if="!going">Cancel</DialogClose>
      <button v-if="going" id="handovershow" class="primary" @click="show">Show now</button>
      <button v-else id="handoverstart" class="primary" :disabled="!chosen" @click="hand">Hand over</button>
    </template>
  </Modal>
</template>

<style>
#handover { width: 640px;
  .relay { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--gap); margin-bottom: var(--pad);
    padding: var(--pad) var(--inset); border-radius: var(--radius); background: var(--toolbar); }
  .side { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; text-align: center;
    .mark { --icon: 40px; width: var(--icon); height: var(--icon); margin-bottom: 6px; transition: scale .3s, opacity .3s; }
    b { color: var(--text-strong); }
    small { max-width: 100%; color: var(--text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } }
  .baton { position: relative; display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0 var(--inset); list-style: none;
    /* the way they go: a line from one agent to the other, under them */
    &::before { content: ""; position: absolute; inset: 50% 0 auto; border-top: 1px dashed var(--line); z-index: 0; }
    li { position: relative; z-index: 1; }
    .faces { display: flex; img + img { margin-inline-start: -5px; } } }
  /* While it reads: what goes along flies over again and again, the new agent taking it in */
  .going {
    .baton li { animation: handed 1.6s ease-in calc(var(--i) * 120ms) infinite; }
    .to .mark { animation: received 1.6s ease-out .5s infinite; } }
  .progress { margin: 0 0 var(--inset); color: var(--text); text-align: center; &[hidden] { display: none; } }
  .hint[hidden] { display: none; }
  .choose { display: flex; flex-direction: column; margin-bottom: var(--inset);
    .item { gap: var(--gap); padding: 0 6px; cursor: default; small { margin-inline-start: auto; } } }
  @media (prefers-reduced-motion: reduce) { .going :is(li, .mark) { animation: none !important; } }
}
@keyframes handed { 55% { translate: 160px 0; scale: .6; opacity: 0; } 56% { translate: 0; scale: 1; opacity: 0; } 80% { opacity: 1; } }
@keyframes received { 30% { scale: 1.15; } 60% { scale: 1; } }
</style>
