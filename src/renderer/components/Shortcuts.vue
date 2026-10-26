<script setup lang="ts">
// Keyboard Shortcuts (docs/window.md, Keys), from the same table that takes the keys (main/keys.ts), so it is never
// out of date. A key held alone (the dictation's) is the human's to change: Change, then the key pressed is it
// (keys:set; the main process says what may not be one).
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import Modal from './Modal.vue';
import { shortcuts } from '../lib/common';
import { registerDialog } from '../lib/dialogs';

const GROUPS = [
  ['global', 'Everywhere', 'In the window, the pages and the terminal.'],
  ['page', 'In a profile\'s page', 'Chrome\'s keys, for that profile\'s pane: also in its address bar.'],
  ['terminal', 'In the terminal', 'Every other key goes to the agent.'],
];
const modal = ref<InstanceType<typeof Modal>>();
registerDialog('shortcuts', { showShortcuts() { modal.value!.open(); } });

const listening = ref<string | null>(null); // the id whose key is pressed next
const message = ref('');
function change(id: string) {
  listening.value = id; message.value = '';
  document.addEventListener('keydown', async function take(e: KeyboardEvent) {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { listening.value = null; return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key) && !e.code) return;
    document.removeEventListener('keydown', take, true);
    listening.value = null;
    const r = await kulisa.invoke('keys:set', { id, code: e.code });
    message.value = r.error || '';
  }, true);
}
</script>

<template>
  <Modal id="shortcuts" ref="modal" title="Keyboard Shortcuts" class="sm:max-w-lg">
    <section v-for="[group, title, hint] in GROUPS" :key="group" class="not-first:mt-6">
      <h3 class="font-medium">{{ title }}</h3><p class="mt-1 mb-2 text-muted-foreground">{{ hint }}</p>
      <dl class="grid grid-cols-[1fr_auto]">
        <template v-for="s in shortcuts.filter((x) => x.group === group)" :key="s.id">
          <dt class="flex min-h-9 items-center border-b">{{ s.label }}</dt>
          <dd class="flex min-h-9 items-center justify-end gap-1.5 border-b">
            <Kbd v-if="listening === s.id">Press a key…</Kbd>
            <Kbd v-for="k in (listening === s.id ? [] : s.keys)" v-else :key="k">{{ k }}</Kbd>
            <Button v-if="s.hold" variant="outline" size="xs" :disabled="listening === s.id"
              title="Press the key to hold instead: a Ctrl, Shift, Alt or ⌘ by its side, an F key, Insert, Pause or Scroll Lock"
              @click="change(s.id)">Change</Button>
          </dd>
        </template>
      </dl>
      <p v-if="group === 'global' && message" class="mt-2 text-destructive select-text" role="alert">{{ message }}</p>
    </section>
    <template #footer><DialogClose as-child><Button>Close</Button></DialogClose></template>
  </Modal>
</template>
