<script setup lang="ts">
// Another terminal of the task (the human's shell, what the agent runs: lib/terminals.ts), a panel next to the
// agent's. Its right-click menu ends with Close.
import { onMounted, ref } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import { otherTermKey, termHost, terminalMenu } from '../../lib/terminals';
import { openMenu } from '../../lib/menu';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const root = ref<HTMLElement>();
onMounted(() => root.value!.append(termHost(otherTermKey(props.params.api.id))));
function menu(e: MouseEvent) { const items = terminalMenu(e.target as Element); if (items) openMenu(items, e); }
</script>

<template>
  <div ref="root" class="termpanel" @contextmenu.prevent="menu" />
</template>
