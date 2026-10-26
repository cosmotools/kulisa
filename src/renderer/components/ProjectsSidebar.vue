<script setup lang="ts">
// The sidebar of every project with its tasks (tasks.md, Projects: all in one place, any task one click away), on
// shadcn-vue's Sidebar: docked in the empty window (Empty.vue), over the grid from the title bar (TopBar.vue). The
// project worked in last first; its tasks open first, then closed, the one closed last first. A row opens its task
// (shows an open one, opens a closed one again); + makes a new task of the project; 🗑 or Delete deletes a task after
// Delete Task…'s question. chosen: a task was opened or made, so the sidebar over the grid closes.
import { computed } from 'vue';
import { SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import AgentState from './AgentState.vue';
import ProjectIcon from './ProjectIcon.vue';
import { store } from '../lib/store';
import { dialog } from '../lib/dialogs';
import { projectColor } from '../lib/project-color';
import { lastWorked, taskLine } from '../lib/common';
import type { ProjectEntry, ProjectTask } from '../../shared/types';
import { FolderPlusIcon, PlusIcon, Trash2Icon } from '@lucide/vue';

const emit = defineEmits<{ chosen: [] }>();
const projects = computed(() => [...store.projects.projects].sort((a, b) => lastWorked(b) - lastWorked(a)));
const tasks = (p: ProjectEntry) => [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)];
const key = (p: ProjectEntry, t: ProjectTask) => `${p.id}/${t.id}`;
// This window's tabs carry their agent's state.
const state = (k: string) => store.projects.tabs.find((t) => t.key === k)?.state;
const note = (t: ProjectTask) => (t.merged ? 'merged' : taskLine(t));
// project:open loads the project when it is not; no task: a new one.
const open = (p: ProjectEntry, t?: ProjectTask) => { emit('chosen'); void kulisa.invoke('project:open', { id: p.id, task: t?.id }); };
const remove = (p: ProjectEntry, t: ProjectTask) => (t.closed ? kulisa.invoke('task:delete-closed', { project: p.id, id: t.id }) : kulisa.invoke('task:delete', key(p, t)));
const newProject = () => { emit('chosen'); void dialog('newproject').then((d) => d.open()); };
</script>

<template>
  <SidebarContent id="projects">
    <SidebarGroup v-for="p in projects" :key="p.id" :data-project="p.id" role="group" :aria-label="p.name" :style="{ '--color': projectColor(p) }">
      <SidebarGroupLabel :title="p.folders[0]"><ProjectIcon :p class="mr-2" /><span class="truncate">{{ p.name }}</span></SidebarGroupLabel>
      <SidebarGroupAction as="button" type="button" :title="`New Task of ${p.name}`" aria-label="New Task" @click="open(p)"><PlusIcon /></SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem v-for="t in tasks(p)" :key="t.id">
            <SidebarMenuButton :data-task="key(p, t)" :aria-label="t.name" :title="t.name" :is-active="key(p, t) === store.current"
              :class="t.closed && 'text-muted-foreground'" @click="open(p, t)" @keydown.delete="remove(p, t)">
              <AgentState :state="state(key(p, t))" />
              <span class="flex-1 truncate">{{ t.name }}</span>
              <span v-if="note(t)" class="max-w-1/2 truncate text-xs text-muted-foreground group-focus-within/menu-item:invisible group-hover/menu-item:invisible">{{ note(t) }}</span>
            </SidebarMenuButton>
            <SidebarMenuAction show-on-hover aria-label="Delete Task…" title="Delete Task…" tabindex="-1" @click="remove(p, t)"><Trash2Icon /></SidebarMenuAction>
          </SidebarMenuItem>
          <SidebarMenuItem v-if="!p.tasks.length" class="px-2 text-sm text-muted-foreground">No tasks yet</SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>
  <SidebarFooter>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton id="sidebarnewproject" title="New Project…: its code, its agents, its profiles" @click="newProject"><FolderPlusIcon /><span>New Project…</span></SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</template>
