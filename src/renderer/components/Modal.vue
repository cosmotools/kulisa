<script setup lang="ts">
// A dialog, one look for all, as in JetBrains (docs/ui.md, Dialogs), on Reka's Dialog: the title with × on top (when
// it may be closed; Esc and a click outside too), the content, the buttons at the bottom right, the main one last. With
// form (formId: its id), the content and the buttons are Reka's form (Enter submits; errors: the main process's answer
// by field, shown at the field's FieldError until it is changed). While it is open the profiles' pages
// are hidden (they are native views above the HTML: lib/views.ts). Kept in the page while closed, so its parts keep
// their state and can be filled before it opens. Afterwards the keyboard is back where it was.
//   <Modal id title> content <template #footer> buttons </template></Modal>
//   ref: await open() (shown, the keyboard in its [autofocus] field or on it), close(), isOpen()
//   closable: false: no ×, Esc or click outside (it waits for an answer); stay: not now (an install under way)
import { watch } from 'vue';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, FormRoot } from 'reka-ui';
import Icon from './Icon.vue';
import { covered } from '../lib/views';

const props = withDefaults(defineProps<{ id: string; title?: string; closable?: boolean; stay?: boolean; form?: boolean; formId?: string;
  errors?: Record<string, string> }>(),
  { closable: true, stay: false });
const emit = defineEmits<{ submit: []; close: [] }>();
const { open } = covered('hide');
watch(open, (o) => { if (!o) emit('close'); });
const keep = (e: Event) => { if (!props.closable || props.stay) e.preventDefault(); };
// Esc in a value edited in place (Editable) puts the value back: the dialog stays.
const esc = (e: KeyboardEvent) => { if ((e.target as Element | null)?.closest?.('.editable')) e.preventDefault(); else keep(e); };
let shown: (() => void) | null = null;
function focus(e: Event) {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  (el.querySelector<HTMLElement>('[autofocus]') || el).focus();
  shown?.(); shown = null;
}
defineExpose({
  open: () => new Promise<void>((resolve) => { if (open.value) return resolve(); shown = resolve; open.value = true; }),  close: () => { open.value = false; },
  isOpen: () => open.value,
});
</script>

<template>
  <DialogRoot v-model:open="open" :unmount-on-hide="false">
    <DialogPortal>
      <DialogOverlay class="backdrop" />
      <DialogContent :id class="dialog" tabindex="-1" :aria-describedby="undefined" @escape-key-down="esc" @interact-outside="keep" @open-auto-focus="focus">
        <header>
          <DialogTitle><slot name="title">{{ title }}</slot></DialogTitle>
          <DialogClose v-if="closable" class="x icon quiet" :disabled="stay" title="Close" aria-label="Close"><Icon name="i-close" /></DialogClose>
        </header>
        <FormRoot v-if="form" :id="formId" :errors @form-submit="emit('submit')">
          <div class="body"><slot /></div>
          <footer><slot name="footer" /></footer>
        </FormRoot>
        <template v-else>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer"><slot name="footer" /></footer>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
