<script setup lang="ts">
// New Project as a dialog (New Project… of the board: a new tab's, the empty window's). With no project at all the
// welcome has the same steps (welcome/).
import { ref } from 'vue';
import Modal from '../Modal.vue';
import Wizard from './Wizard.vue';
import { registerDialog } from '../../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>(), wizard = ref<InstanceType<typeof Wizard>>();
async function open() {
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
   step scrolls and the buttons stay (a body's 320px would push them out of a 640×400 window). */
#newproject { width: min(760px, 92vw); min-height: min(480px, 85vh);
  .body { display: flex; padding: 0; }
}
</style>
