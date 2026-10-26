<script setup lang="ts">
// A new account of an agent, signed in with the agent's own sign-in (docs/tasks.md, Accounts).
// Its terminal is under Details: the address it prints, with the sign-in window open, only confuses; it
// is there for a failure and for what the window does not show (a code the agent asks for).
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FieldDescription, FieldError } from '@/components/ui/field';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { forgetTerminals, View } from '../../terminal/renderer';
import type { SignedIn } from '../../shared/types';
import { ChevronDownIcon } from '@lucide/vue';

const props = defineProps<{ project?: string | null; agent: { id: string; name: string } }>();
const emit = defineEmits<{ done: [r: SignedIn]; close: [] }>();
let n = 0, shown = ''; // kept after its sign-in ends: a failure's Details show what the agent said
const host = ref<HTMLElement>();
const running = ref(''), error = ref(''), details = ref(false); // running: the sign-in terminal's key
const view = new View({ background: '--background' });

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
  <div id="npsignin" class="flex flex-col gap-2">
    <FieldDescription>Signing in to a new account of {{ agent.name }}: sign in in your browser, which opens (check the account
      it signs in to there; its address is under Details if it did not open). The account is {{ project ? 'added' : 'kept' }} once you are signed in.</FieldDescription>
    <Collapsible v-model:open="details" :unmount-on-hide="false">
      <CollapsibleTrigger as-child><Button variant="link" size="sm" class="h-auto px-0 text-muted-foreground">Details<ChevronDownIcon
        class="transition-transform group-data-[state=open]/button:rotate-180" /></Button></CollapsibleTrigger>
      <!-- Its terminal, a few rows high, framed as a field -->
      <CollapsibleContent><div id="npsigninterm" ref="host" class="mt-1.5 h-40 overflow-hidden rounded-lg border" /></CollapsibleContent>
    </Collapsible>
    <FieldError id="npsigninerror" class="empty:hidden">{{ error }}</FieldError>
    <div class="flex gap-2">
      <Button id="npsigninstart" variant="outline" :hidden="!!running" @click="start">Try Again</Button>
      <Button id="npsignincancel" variant="outline" @click="cancel">Cancel</Button>
    </div>
  </div>
</template>
