<script setup lang="ts">
// A Kulisa window (docs/window.md).
import TopBar from './TopBar.vue';
import Grid from './Grid.vue';
import TaskBar from './TaskBar.vue';
import Empty from './Empty.vue';
import NewProject from './newproject/NewProject.vue';
import TaskRename from './TaskRename.vue';
import AgentPicker from './AgentPicker.vue';
import HandOver from './HandOver.vue';
import Shortcuts from './Shortcuts.vue';
import Ask from './Ask.vue';
import PointMenu from './menu/PointMenu.vue';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { menuAtPoint } from '../lib/menu';
import { store } from '../lib/store';

thumbnailMenu(menuAtPoint);
</script>

<template>
  <!-- The tasks' bar in the title bar, as a browser's tabs, or under the grid (☰ → Tasks bar: Top, Bottom); none with
       no task open: no tab, and the sidebar shows every task -->
  <TopBar><TaskBar v-if="store.bar === 'top' && store.current !== null" /></TopBar>
  <Grid />
  <Empty />
  <TaskBar v-if="store.bar !== 'top' && store.current !== null" />
  <NewProject />
  <TaskRename />
  <AgentPicker />
  <HandOver />
  <Shortcuts />
  <Ask />
  <Thumbnail />
  <PointMenu />
</template>
