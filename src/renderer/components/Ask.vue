<script setup lang="ts">
// The question (lib/ask.ts), on shadcn-vue's AlertDialog. A click outside does nothing: it waits for an answer.
import { shallowRef, watch } from 'vue';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { asking } from '../lib/ask';
import { covered, keepTaken } from '../lib/cover';

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
  <AlertDialog v-model:open="open">
    <AlertDialogContent id="ask" @close-auto-focus="keepTaken">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ q?.message }}</AlertDialogTitle>
        <!-- An error in it is text to copy (to search for it) -->
        <AlertDialogDescription class="wrap-anywhere whitespace-pre-line select-text empty:hidden">{{ q?.detail }}</AlertDialogDescription>
        <Button v-if="q?.link" variant="link" class="h-auto p-0" as-child><a target="_blank" :href="q.link.url">{{ q.link.label }}</a></Button>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ q?.cancel || 'Cancel' }}</AlertDialogCancel>
        <AlertDialogAction v-if="q?.other" variant="outline" @click="answer = 'other'">{{ q.other }}</AlertDialogAction>
        <AlertDialogAction :variant="q?.danger ? 'destructive' : 'default'" @click="answer = 'ok'">{{ q?.ok || 'OK' }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
