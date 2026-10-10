<script setup lang="ts">
// Another terminal's header: its name (the command it runs on hover), × closing it (what runs there stops).
import { computed } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import { act, store } from '../../lib/store';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const id = Number(props.params.api.id.slice('term:'.length));
const t = computed(() => store.otherTerms.find((x) => x.id === id));
</script>

<template>
  <div class="ptab" :title="t?.command">
    <b>{{ t?.name }}</b>
    <button class="close icon quiet" title="Close terminal: what runs there stops" aria-label="Close terminal" @click="act('terminal:close', { id })"><Icon name="i-close" /></button>
  </div>
</template>
