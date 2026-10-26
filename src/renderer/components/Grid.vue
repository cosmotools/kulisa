<script setup lang="ts">
// The grid of the shown task (lib/grid.ts; docs/window.md, The grid), dockview's, themed in app.css. A profile's page
// is a native view over its pane's content (ProfilePane.vue).
import { markRaw } from 'vue';
import { DockviewVue, themeDark, type IDockviewVueProps } from 'dockview-vue';
import 'dockview-vue/dist/styles/dockview.css';
import ProfilePane from './grid/ProfilePane.vue';
import ProfileHeader from './grid/ProfileHeader.vue';
import Terminals from './grid/Terminals.vue';
import TerminalTabs from './grid/TerminalTabs.vue';
import ClosedProfiles from './grid/ClosedProfiles.vue';
import Resources from './Resources.vue';
import ResourcesTab from './ResourcesTab.vue';
import { gridMounted } from '../lib/grid';
import { store } from '../lib/store';

const theme = { ...themeDark, name: 'kulisa' };
const components = markRaw({ profile: ProfilePane, terminal: Terminals, resources: Resources }) as unknown as IDockviewVueProps['components']; // dockview-vue types its components as option objects
const tabComponents = markRaw({ profile: ProfileHeader, terminal: TerminalTabs, resources: ResourcesTab }) as unknown as IDockviewVueProps['tabComponents'];
</script>

<template>
  <!-- min-w-0: a row wider than the window (many closed profiles over the terminal) would stretch the window's column,
       the terminal and the tasks' bar past its edge. Unseen until the grid is laid out (lib/grid.ts, reveal). -->
  <main id="dock" class="col-start-1 row-start-2 flex min-w-0 flex-col border-t transition-opacity duration-150 aria-busy:opacity-0 aria-busy:transition-none"
    :aria-busy="store.loading || undefined" :hidden="store.current === null">
    <ClosedProfiles />
    <DockviewVue id="grid" class="min-h-0 flex-1" :theme :disable-floating-groups="true" single-tab-mode="fullwidth" :components :tab-components="tabComponents"
      @ready="(e) => gridMounted(e.api)" />
  </main>
</template>
