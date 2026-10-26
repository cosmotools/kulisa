<script setup lang="ts">
// What the empty window shows in the grid's place when no task is open (lib/store.ts, page): with no project at all,
// the welcome (welcome/: what Kulisa does, then the first project's steps); else the sidebar of every project with its
// tasks, docked. A task's grid is shown by the grid itself.
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import Welcome from './welcome/Welcome.vue';
import ProjectsSidebar from './ProjectsSidebar.vue';
import { page } from '../lib/store';
</script>

<template>
  <!-- safe: what is taller than the window starts at its top, where scrolling reaches it -->
  <section v-if="page === 'welcome'" id="empty" class="col-start-1 row-start-2 grid place-items-center-safe overflow-auto"><Welcome /></section>
  <SidebarProvider v-else-if="page === 'projects'" id="empty" class="col-start-1 row-start-2 min-h-0 border-t">
    <Sidebar collapsible="none" class="h-full border-r"><ProjectsSidebar /></Sidebar>
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No task open</EmptyTitle>
        <EmptyDescription>Open a task on the left, or make a new one with + by its project.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  </SidebarProvider>
</template>
