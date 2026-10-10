<script setup lang="ts">
// Another terminal of the task (the human's shell, what the agent runs: lib/terminals.ts), a panel next to the
// agent's. Its right-click menu ends with Close.
import { onMounted, ref } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import { otherTermKey, termHost, terminalMenu } from '../../lib/terminals';
import RightClickMenu from '../menu/RightClickMenu.vue';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const root = ref<HTMLElement>();
onMounted(() => root.value!.append(termHost(otherTermKey(props.params.api.id))));
</script>

<template>
  <RightClickMenu :items="(e) => terminalMenu(e.target as Element)"><div ref="root" class="termpanel" /></RightClickMenu>
</template>
