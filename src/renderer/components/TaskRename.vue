<script setup lang="ts">
// Rename… a task (tasks.md, Tasks). The main process's refusal is shown at the field until the name is changed.
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import Modal from './Modal.vue';
import { registerDialog } from '../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>(), field = ref<{ $el: HTMLInputElement }>();
const input = computed(() => field.value?.$el);
const error = ref('');
let renaming = '';
registerDialog('taskrename', {
  async rename(key, current) {
    renaming = key; error.value = '';
    await modal.value!.open();
    input.value!.value = current; input.value!.focus(); input.value!.select();
  },
});
async function save() {
  const name = input.value!.value;
  if (!name.trim()) return input.value!.focus();
  const r = await kulisa.invoke('task:rename', { key: renaming, name });
  if (r?.error) error.value = r.error; else modal.value!.close();
}
</script>

<template>
  <Modal id="taskrename" ref="modal" title="Rename Task">
    <form id="taskform" @submit.prevent="save">
      <Field :data-invalid="!!error || undefined">
        <FieldLabel for="taskname">Name</FieldLabel>
        <Input id="taskname" ref="field" maxlength="64" placeholder="e.g. Fix header" spellcheck="false" :aria-invalid="!!error || undefined"
          @input="error = ''" />
        <FieldError v-if="error" class="select-text">{{ error }}</FieldError>
        <FieldDescription>What the task is about. Its git branch takes it too (fix-header); its folder stays. The agent names it as
          well, once it knows.</FieldDescription>
      </Field>
    </form>
    <template #footer>
      <DialogClose as-child><Button variant="outline">Cancel</Button></DialogClose>
      <Button id="taskrenamed" type="submit" form="taskform">Rename</Button>
    </template>
  </Modal>
</template>
