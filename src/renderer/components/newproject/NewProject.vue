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
  <!-- Its height the dialog's, not the step's: the same for every step while the window has room -->
  <Modal id="newproject" ref="modal" title="New Project" :stay="!!wizard?.saving" class="min-h-[min(30rem,85vh)] sm:max-w-3xl">
    <Wizard ref="wizard" cancelable @done="modal?.close()" />
  </Modal>
</template>
