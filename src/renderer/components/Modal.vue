<script setup lang="ts">
// A dialog (docs/ui.md, Dialogs), on shadcn-vue's Dialog. While it is open the profiles' pages are hidden (native views
// above the HTML: lib/views.ts). Its content is in the page only while it is open (Reka's default: a closed dialog costs
// no memory), so a dialog opens first and then fills its fields; what must outlive it lives in the dialog's own
// component (its setup) or in lib/.
//   <Modal id title class="sm:max-w-xl"> content <template #footer> buttons </template></Modal>
//   ref: await open() (shown, its content there, the keyboard in its [autofocus] field or on it), close(), isOpen()
//   closable: false: no ×, Esc or click outside (it waits for an answer); stay: not now (an install under way)
import { watch } from 'vue';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { covered, keepTaken } from '../lib/cover';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ id: string; title: string; closable?: boolean; stay?: boolean }>(), { closable: true, stay: false });
const emit = defineEmits<{ close: [] }>();
const { open } = covered('hide');
watch(open, (o) => { if (!o) emit('close'); });
const keep = (e: Event) => { if (!props.closable || props.stay) e.preventDefault(); };
let shown: (() => void) | null = null;
function focus(e: Event) {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  (el.querySelector<HTMLElement>('[autofocus]') || el).focus();
  shown?.(); shown = null;
}
defineExpose({
  open: () => new Promise<void>((resolve) => { if (open.value) return resolve(); shown = resolve; open.value = true; }),
  close: () => { open.value = false; },
  isOpen: () => open.value,
});
</script>

<template>
  <Dialog v-model:open="open">
    <!-- The body scrolls in a window too short for it, the title and the buttons staying; or a part in it does (New
         Project's step), filling it -->
    <DialogContent :id v-bind="$attrs" class="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]" :show-close-button="closable && !stay"
      :aria-describedby="undefined" @escape-key-down="keep" @interact-outside="keep" @open-auto-focus="focus" @close-auto-focus="keepTaken">
      <DialogHeader><DialogTitle>{{ title }}</DialogTitle></DialogHeader>
      <div class="-mx-4 flex flex-col overflow-y-auto px-4"><slot /></div>
      <DialogFooter v-if="$slots.footer"><slot name="footer" /></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
