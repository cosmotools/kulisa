<script setup lang="ts">
// Keyboard Shortcuts (☰, or its key): every key of Kulisa, as this OS shows it, from the same table that takes them
// (main/keys.js), so it is never out of date: a group's heading and what it is about, then each command and its keys
// as key caps, one under the other.
import { ref } from 'vue';
import Modal from './Modal.vue';
import { shortcuts } from '../lib/common';
import { registerDialog } from '../lib/dialogs';

const GROUPS = [
  ['global', 'Everywhere', 'In the window, the pages and the terminal.'],
  ['page', 'In a profile\'s page', 'Chrome\'s keys, for that profile\'s pane: also in its address bar.'],
  ['terminal', 'In the terminal', 'Every other key goes to the agent.'],
];
const modal = ref<InstanceType<typeof Modal>>();
registerDialog('shortcuts', { showShortcuts() { if (!modal.value!.el!.open) modal.value!.open(); } });
</script>

<template>
  <Modal id="shortcuts" ref="modal" title="Keyboard Shortcuts">
    <section v-for="[group, title, hint] in GROUPS" :key="group" class="keygroup">
      <h3>{{ title }}</h3><p class="hint">{{ hint }}</p>
      <dl>
        <template v-for="s in shortcuts.filter((x) => x.group === group)" :key="s.id">
          <dt>{{ s.label }}</dt><dd><kbd v-for="k in s.keys" :key="k">{{ k }}</kbd></dd>
        </template>
      </dl>
    </section>
    <template #footer><button class="primary" type="button" command="close" commandfor="shortcuts">Close</button></template>
  </Modal>
</template>

<style>
#shortcuts {
  .keygroup + .keygroup { margin-top: calc(var(--gap) * 2); }
  h3 { margin: 0; font-size: 1em; color: var(--text-dim); }
  .hint { margin: 2px 0 var(--inset); }
  dl { display: grid; grid-template-columns: 1fr auto; margin: 0; }
  :is(dt, dd) { display: flex; align-items: center; min-height: var(--row); border-bottom: 1px solid var(--island-hi); }
  dd { justify-content: end; gap: 6px; margin: 0; }
  kbd { padding: 1px 6px; border: 1px solid var(--line); border-radius: var(--radius); color: var(--text); white-space: nowrap; }
}
</style>
