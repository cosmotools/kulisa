<script setup lang="ts">
// The question (lib/ask.ts): its title, what goes as its text, Cancel (focused) and the button that does it (red when
// it deletes), another way before it when there is one.
import { nextTick, ref, watch } from 'vue';
import Modal from './Modal.vue';
import { asking } from '../lib/ask';

const modal = ref<InstanceType<typeof Modal>>();
watch(asking, async (a) => {
  if (!a) return;
  await nextTick();
  modal.value!.el!.returnValue = '';
  modal.value!.open();
});
function closed() {
  const a = asking.value;
  asking.value = null;
  a?.answer(modal.value!.el!.returnValue);
}
</script>

<template>
  <Modal id="ask" ref="modal" @close="closed">
    <template #title>{{ asking?.q.message }}</template>
    <p class="detail">{{ asking?.q.detail }}</p>
    <template #footer>
      <button value="" autofocus @click="modal!.close('')">Cancel</button>
      <button v-if="asking?.q.other" value="other" class="other" @click="modal!.close('other')">{{ asking.q.other }}</button>
      <button value="ok" :class="['ok', asking?.q.danger ? 'danger' : 'primary']" @click="modal!.close('ok')">{{ asking?.q.ok || 'OK' }}</button>
    </template>
  </Modal>
</template>

<style>
#ask { width: 480px;
  .detail { margin: 0; white-space: pre-line; overflow-wrap: anywhere; user-select: text; &:empty { display: none; } } }
</style>
