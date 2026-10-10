<script setup lang="ts">
// Rename… in a task tab's menu (TaskTab.vue): its name, and its branch with it; its folder stays.
import { ref } from 'vue';
import Modal from './Modal.vue';
import { registerDialog } from '../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>(), input = ref<HTMLInputElement>();
const error = ref('');
let renaming = '';
registerDialog('taskrename', {
  async rename(key, current) {
    renaming = key; input.value!.value = current; error.value = '';
    modal.value!.open();
    input.value!.select();
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
  <Modal id="taskrename" ref="modal" title="Rename Task" form form-id="taskform" @submit="save">
    <p class="hint">What the task is about. Its git branch takes the name too; its folder stays. The agent names it as well,
      once it knows.</p>
    <label class="field"><span>Name</span><input id="taskname" ref="input" data-name maxlength="64" placeholder="e.g. checkout-redesign" spellcheck="false"></label>
    <p class="error">{{ error }}</p>
    <template #footer>
      <button type="button" command="close" commandfor="taskrename">Cancel</button><button id="taskrenamed" class="primary">Rename</button>
    </template>
  </Modal>
</template>
