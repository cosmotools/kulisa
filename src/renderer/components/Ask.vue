<script setup lang="ts">
// The question (lib/ask.ts), on Reka's AlertDialog. A click outside does nothing: it waits for an answer.
import { shallowRef, watch } from 'vue';
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal,
  AlertDialogRoot, AlertDialogTitle } from 'reka-ui';
import { asking } from '../lib/ask';
import { covered } from '../lib/cover';

const { open } = covered('hide');
const q = shallowRef(asking.value?.q);
let answer = '';
watch(asking, (a) => { if (a) { q.value = a.q; answer = ''; open.value = true; } });
watch(open, (o) => {
  if (o) return;
  const a = asking.value;
  asking.value = null;
  a?.answer(answer);
});
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="backdrop" />
      <AlertDialogContent id="ask" class="dialog question">
        <header><AlertDialogTitle>{{ q?.message }}</AlertDialogTitle></header>
        <div class="body"><AlertDialogDescription class="detail">{{ q?.detail }}</AlertDialogDescription>
          <a v-if="q?.link" class="link" target="_blank" :href="q.link.url">{{ q.link.label }}</a></div>
        <footer>
          <AlertDialogCancel class="cancel">{{ q?.cancel || 'Cancel' }}</AlertDialogCancel>
          <AlertDialogAction v-if="q?.other" class="other" @click="answer = 'other'">{{ q.other }}</AlertDialogAction>
          <AlertDialogAction :class="['ok', q?.danger ? 'danger' : 'primary']" @click="answer = 'ok'">{{ q?.ok || 'OK' }}</AlertDialogAction>
        </footer>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style>
#ask { width: 480px;
  .detail { margin: 0; white-space: pre-line; overflow-wrap: anywhere; user-select: text; &:empty { display: none; } }
  .link { display: block; margin-top: var(--inset); color: var(--accent); } }
</style>
