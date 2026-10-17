<script setup lang="ts">
// New Project as a dialog (New Project… of a new tab or the empty window). With no project at all the wizard is there
// already, in the grid's place (Empty.vue): it gets the keyboard instead.
import { ref } from 'vue';
import Modal from '../Modal.vue';
import Wizard from './Wizard.vue';
import { registerDialog } from '../../lib/dialogs';
import { page } from '../../lib/store';

const modal = ref<InstanceType<typeof Modal>>(), wizard = ref<InstanceType<typeof Wizard>>();
async function open() {
  if (page.value === 'wizard') { document.getElementById('npname')?.focus(); return; }
  await modal.value!.open();
  await wizard.value!.focus();
}
registerDialog('newproject', { open });
</script>

<template>
  <Modal id="newproject" ref="modal" title="New Project" :stay="!!wizard?.saving">
    <Wizard ref="wizard" cancelable @done="modal?.close()" />
  </Modal>
</template>

<style>
/* Its height the dialog's, not the body's: the same for every step while the window has room; in a shorter one the
   step scrolls and the buttons stay (a body's 320px pushed them out of a 640×400 window, 2026-10-16). */
#newproject { width: min(760px, 92vw); min-height: min(480px, 85vh);
  .body { display: flex; padding: 0; }
}
</style>
