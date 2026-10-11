<script setup lang="ts">
// Another terminal of the task, a panel next to the agent's (docs/window.md, The terminal; lib/terminals.ts).
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
