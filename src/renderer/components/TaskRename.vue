<script setup lang="ts">
// Rename… in a task tab's menu (TaskTab.vue): its name, and its branch with it; its folder stays. The main process's
// refusal is shown at the field (Reka's FieldError) until the name is changed.
import { computed, ref } from 'vue';
import { DialogClose, FieldControl, FieldError, FieldLabel, FieldRoot } from 'reka-ui';
import Modal from './Modal.vue';
import { registerDialog } from '../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>(), field = ref<{ $el: HTMLInputElement }>();
const input = computed(() => field.value?.$el);
const error = ref('');
let renaming = '';
registerDialog('taskrename', {
  async rename(key, current) {
    renaming = key; input.value!.value = current; error.value = '';
    await modal.value!.open();
    input.value!.focus(); input.value!.select();
  },
});
async function save() {
  const name = input.value!.value;
  if (!name.trim()) return input.value!.focus();
  const r = await kulisa.invoke<{ error?: string } | null>('task:rename', { key: renaming, name });
  if (r?.error) error.value = r.error; else modal.value!.close();
}
</script>

<template>
  <Modal id="taskrename" ref="modal" title="Rename Task" form form-id="taskform" :errors="error ? { name: error } : undefined" @submit="save">
    <p class="hint">What the task is about. Its git branch takes the name too; its folder stays. The agent names it as well,
      once it knows.</p>
    <FieldRoot class="field" name="name"><FieldLabel>Name</FieldLabel><FieldControl id="taskname" ref="field" data-name maxlength="64"
      placeholder="e.g. checkout-redesign" spellcheck="false" /><FieldError class="error" /></FieldRoot>
    <template #footer>
      <DialogClose>Cancel</DialogClose><button id="taskrenamed" class="primary">Rename</button>
    </template>
  </Modal>
</template>
