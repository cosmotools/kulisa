<script setup lang="ts">
// Keyboard Shortcuts (docs/window.md, Keys), from the same table that takes the keys (main/keys.js), so it is never
// out of date.
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
</script>

<template>
  <Modal id="shortcuts" ref="modal" title="Keyboard Shortcuts">
    <section v-for="[group, title, hint] in GROUPS" :key="group" class="keygroup">
      <h3 class="titled">{{ title }}</h3><p class="hint">{{ hint }}</p>
      <dl>
        <template v-for="s in shortcuts.filter((x) => x.group === group)" :key="s.id">
          <dt>{{ s.label }}</dt><dd><kbd v-for="k in s.keys" :key="k">{{ k }}</kbd></dd>
        </template>
      </dl>
    </section>
    <template #footer><DialogClose class="primary">Close</DialogClose></template>
  </Modal>
</template>

<style>
#shortcuts {
  .keygroup + .keygroup { margin-top: calc(var(--gap) * 2); }
  .hint { margin: 4px 0 var(--gap); }
  dl { display: grid; grid-template-columns: 1fr auto; margin: 0; }
  :is(dt, dd) { display: flex; align-items: center; min-height: var(--row); border-bottom: 1px solid var(--island-hi); }
  dd { justify-content: end; gap: 6px; margin: 0; }
  kbd { padding: 1px 6px; border: 1px solid var(--line); border-radius: var(--radius); color: var(--text); white-space: nowrap; }
}
</style>
