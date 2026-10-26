<script setup lang="ts">
// Keyboard Shortcuts (docs/window.md, Keys), from the same table that takes the keys (main/keys.ts), so it is never
// out of date. A key held alone (the dictation's) is the human's to change: Change, then the key pressed is it
// (keys:set; the main process says what may not be one).
import { ref } from 'vue';
import { DialogClose } from 'reka-ui';
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
  <Modal id="shortcuts" ref="modal" title="Keyboard Shortcuts">
    <section v-for="[group, title, hint] in GROUPS" :key="group" class="keygroup">
      <h3 class="titled">{{ title }}</h3><p class="hint">{{ hint }}</p>
      <dl>
        <template v-for="s in shortcuts.filter((x) => x.group === group)" :key="s.id">
          <dt>{{ s.label }}</dt>
          <dd>
            <kbd v-if="listening === s.id" class="listening">Press a key…</kbd>
            <kbd v-for="k in (listening === s.id ? [] : s.keys)" v-else :key="k">{{ k }}</kbd>
            <button v-if="s.hold" class="change" :disabled="listening === s.id" title="Press the key to hold instead: a Ctrl, Shift, Alt or ⌘ by its side, an F key, Insert, Pause or Scroll Lock"
              @click="change(s.id)">Change</button>
          </dd>
        </template>
      </dl>
      <p v-if="group === 'global' && message" class="hint error" role="alert">{{ message }}</p>
    </section>
    <template #footer><DialogClose class="primary">Close</DialogClose></template>
  </Modal>
</template>

<style>
#shortcuts {
  .keygroup + .keygroup { margin-top: calc(var(--gap) * 2); }
  .hint { margin: 4px 0 var(--gap); }
  .hint.error { margin: var(--gap) 0 0; color: var(--danger); }
  dl { display: grid; grid-template-columns: 1fr auto; margin: 0; }
  :is(dt, dd) { display: flex; align-items: center; min-height: var(--row); border-bottom: 1px solid var(--island-hi); }
  dd { justify-content: end; gap: 6px; margin: 0; }
  kbd { padding: 1px 6px; border: 1px solid var(--line); border-radius: var(--corner); color: var(--text); white-space: nowrap; }
  kbd.listening { color: var(--text-muted); border-style: dashed; }
  .change { height: 24px; padding: 0 8px; font-size: var(--font-small); }
}
</style>
