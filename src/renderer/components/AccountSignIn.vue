<script setup lang="ts">
// A new account of an agent, signed in with the agent's own sign-in (docs/tasks.md, Accounts).
// Its terminal is under Details: the address it prints, with the sign-in window open, only confuses; it
// is there for a failure and for what the window does not show (a code the agent asks for).
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { forgetTerminals, View } from '../../terminal/renderer';
import type { SignedIn } from '../../shared/types';
import { ChevronDownIcon } from '@lucide/vue';

const props = defineProps<{ project?: string | null; agent: { id: string; name: string } }>();
const emit = defineEmits<{ done: [r: SignedIn]; close: [] }>();
let n = 0, shown = ''; // kept after its sign-in ends: a failure's Details show what the agent said
const host = ref<HTMLElement>();
const running = ref(''), error = ref(''), details = ref(false); // running: the sign-in terminal's key
const view = new View({ background: '--island' }); // the dialog's

async function start() {
  error.value = '';
  details.value = false;
  if (shown) forgetTerminals([shown]);
  const key = running.value = shown = `signin#${Date.now()}-${++n}`;
  if (view.el.parentElement !== host.value) host.value!.append(view.el);
  view.show(key);
  const r = await kulisa.invoke('account:signin', { id: props.project ?? null, agent: props.agent.id, key });
  if (running.value === key) running.value = '';
  if (r.error) { error.value = r.error; details.value = true; }
  else if (r.error === undefined) emit('done', r);
}
async function stop() {
  const key = running.value;
  running.value = '';
  if (key) await kulisa.invoke('account:signin-cancel', { key });
}
async function cancel() { await stop(); emit('close'); }
onMounted(start);
onBeforeUnmount(() => { void stop(); forgetTerminals([shown]); view.dispose(); });
</script>

<template>
  <div id="npsignin">
    <p class="hint">Signing in to a new account of {{ agent.name }}: sign in in your browser, which opens (check the account
      it signs in to there; its address is under Details if it did not open). The account is {{ project ? 'added' : 'kept' }} once you are signed in.</p>
    <CollapsibleRoot v-model:open="details" :unmount-on-hide="false">
      <CollapsibleTrigger class="disclose"><ChevronDownIcon />Details</CollapsibleTrigger>
      <CollapsibleContent><div id="npsigninterm" ref="host" /></CollapsibleContent>
    </CollapsibleRoot>
    <p id="npsigninerror" class="error">{{ error }}</p>
    <div class="row">
      <button id="npsigninstart" type="button" :hidden="!!running" @click="start">Try Again</button>
      <button id="npsignincancel" type="button" @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<style>
/* Its terminal, a few rows high, framed as a field */
#npsignin {
  .hint { margin-block: 0 var(--inset); }
  #npsigninterm { height: 160px; margin-block-start: 6px; border: 1px solid var(--line); border-radius: var(--corner); }
}
</style>
