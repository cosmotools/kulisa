<script setup lang="ts">
// A dialog, one look for all, as in JetBrains (docs/ui.md, Dialogs): the title with × on top (when it may be closed;
// Esc and a click outside too: closedby), the content, the buttons at the bottom right, the main one last. With form (formId:
// its id), the content and the buttons are a form (Enter submits). While it is open the profiles' pages are hidden (they are
// native views above the HTML: lib/views.ts).
//   <Modal id title> content <template #footer> buttons </template></Modal>; ref: open(), close(), el
import { ref } from 'vue';
import Icon from './Icon.vue';
import { showModal } from '../lib/views';

withDefaults(defineProps<{ id: string; title?: string; closable?: boolean; closedby?: 'any' | 'none' | 'closerequest'; form?: boolean; formId?: string }>(),
  { closable: true, closedby: 'any' });
const emit = defineEmits<{ submit: []; close: []; cancel: [e: Event] }>();
const el = ref<HTMLDialogElement>();
defineExpose({ open: () => showModal(el.value!), close: (value?: string) => el.value?.close(value), el });
</script>

<template>
  <dialog :id ref="el" :closedby @close="emit('close')" @cancel="emit('cancel', $event)">
    <header>
      <h2><slot name="title">{{ title }}</slot></h2>
      <button v-if="closable" class="x icon quiet" type="button" command="close" :commandfor="id" title="Close" aria-label="Close"><Icon name="i-close" /></button>
    </header>
    <form v-if="form" :id="formId" @submit.prevent="emit('submit')">
      <div class="body"><slot /></div>
      <footer><slot name="footer" /></footer>
    </form>
    <template v-else>
      <div class="body"><slot /></div>
      <footer v-if="$slots.footer"><slot name="footer" /></footer>
    </template>
  </dialog>
</template>
