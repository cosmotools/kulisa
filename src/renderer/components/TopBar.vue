<script setup lang="ts">
// The window's title bar (the logo, the sidebar's button while a task is shown, the tasks' bar when it is there,
// Settings, ☰) and ☰'s menu (docs/window.md, The title bar, Menus). env(titlebar-area-*) leaves room for the OS
// window buttons on every platform (titleBarOverlay in window.ts). Exit only where the OS has no menu bar
// with Quit (not macOS: Cmd+Q there). No logo on macOS: its apps show their icon in the Dock, not by the window's
// buttons.
import { watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import ButtonMenu from './menu/ButtonMenu.vue';
import ProjectsSidebar from './ProjectsSidebar.vue';
import ZoomRow from './menu/ZoomRow.vue';
import ChoiceRow from './menu/ChoiceRow.vue';
import LanguageRow from './menu/LanguageRow.vue';
import ArrangeRow from './menu/ArrangeRow.vue';
import { store } from '../lib/store';
import { keyText, LINKS, withKeys } from '../lib/common';
import { covered, keepTaken } from '../lib/cover';
import type { MenuItem } from '../lib/menu';
import type { Bar, Theme } from '../../shared/ipc';
import { dialog, openSettings } from '../lib/dialogs';
import { BugIcon, FolderOpenIcon, KeyboardIcon, LayoutPanelLeftIcon, LogOutIcon, MenuIcon, PanelLeftIcon, SettingsIcon, SunMoonIcon } from '@lucide/vue';
import LogoMark from './marks/LogoMark.vue';

const mac = kulisa.platform === 'darwin';
// The sidebar over the grid: a sheet, as shadcn-vue's Sidebar is on a narrow screen; the profiles' pages, native views
// above the page, hidden while it is open, as under a dialog.
// With no task open the empty window shows it docked.
const { open: sidebar } = covered('hide');
watch(() => store.current === null, (none) => { if (none) sidebar.value = false; });
const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System', title: 'As the operating system' }];
const BARS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];
const windowMenu = (): MenuItem[] => [
    { component: ZoomRow },
    { component: ChoiceRow, props: { kind: 'theme', icon: SunMoonIcon, label: 'Theme', choices: THEMES, chosen: () => store.theme,
      choose: (t: string) => kulisa.invoke('theme:set', t as Theme) } }, // one of THEMES
    { component: ChoiceRow, props: { kind: 'bar', icon: FolderOpenIcon, label: 'Tasks bar', choices: BARS, chosen: () => store.bar,
      choose: (b: string) => kulisa.invoke('bar:set', b as Bar) } }, // one of BARS
    { component: LanguageRow },
    '-', { heading: 'Arrange panels', icon: LayoutPanelLeftIcon }, { component: ArrangeRow }, '-',
    { label: 'Keyboard Shortcuts', icon: KeyboardIcon, keys: keyText('shortcuts'), run: async () => (await dialog('shortcuts')).showShortcuts() },
    '-', ...LINKS.map((l) => ({ label: l.label, icon: l.icon, run: () => open(l.href) })),
    { label: 'Report a Problem…', icon: BugIcon, title: 'The log of what Kulisa did, and how to send it', run: () => openSettings('log') },
    { label: 'About Kulisa', icon: LogoMark, run: () => openSettings('about') },
    ...(mac ? [] : ['-' as const, { label: 'Exit', icon: LogOutIcon, run: () => kulisa.invoke('app:quit') }])];
</script>

<template>
  <!-- The area starts after the OS buttons on macOS (at their x) and ends before them elsewhere (env(titlebar-area-*)): the
       bar is as wide as its end, or ☰ stood the buttons' width short of the window's edge on macOS. -->
  <header id="topbar" class="flex h-11 w-[calc(env(titlebar-area-x,0px)+env(titlebar-area-width,100%))] items-center gap-1 pr-2 pl-[calc(env(titlebar-area-x,0px)+(--spacing(2)))] [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
    <slot /><!-- the tasks' bar, when it is here (App.vue) -->
    <!-- The logo and the space after the tasks' bar are where the window is dragged by, however many tabs. Chromium takes
         the tabs scrolled past the bar's edges as no-drag too, over them (not clipped by the bar), and the regions in the
         page's order, the last one winning: so both come after the tasks' bar in the page, put back first by order (else
         neither drags the window with the bar full). The space is at least 40 px, as Chrome's after its +. -->
    <LogoMark v-if="!mac" class="order-first mr-1 size-6.5 text-(--project) [-webkit-app-region:drag]" data-testid="title-logo" />
    <Button v-if="store.current !== null" id="sidebarToggle" class="order-first" variant="ghost" size="icon-sm" :title="withKeys('Projects and tasks: every task, open or closed', 'task.menu')"
      aria-label="Projects and tasks" :aria-expanded="sidebar" @click="sidebar = !sidebar"><PanelLeftIcon /></Button>
    <Sheet v-model:open="sidebar">
      <SheetContent side="left" class="w-72 gap-0 bg-sidebar p-0" :show-close-button="false" :aria-describedby="undefined" @close-auto-focus="keepTaken">
        <SheetTitle class="sr-only">Projects and tasks</SheetTitle>
        <SidebarProvider class="min-h-0 flex-1"><Sidebar collapsible="none" class="w-full"><ProjectsSidebar @chosen="sidebar = false" /></Sidebar></SidebarProvider>
      </SheetContent>
    </Sheet>
    <span class="flex-[1_0_--spacing(10)] self-stretch [-webkit-app-region:drag]" data-testid="drag-area" />
    <Button id="zoomReset" variant="ghost" size="sm" :hidden="store.zoom === 1" title="Kulisa's zoom. Click to reset (Ctrl 0)" @click="kulisa.invoke('zoom:ui', 0)">{{ Math.round(store.zoom * 100) }}%</Button>
    <Button id="manageProjects" variant="ghost" size="icon-sm" :hidden="!store.projects.settings" title="Settings: projects, agents" aria-label="Settings"
      @click="openSettings()"><SettingsIcon /></Button>
    <ButtonMenu :items="windowMenu" end><Button id="windowMenu" variant="ghost" size="icon-sm" title="Menu: zoom, layout" aria-label="Menu"><MenuIcon /></Button></ButtonMenu>
  </header>
</template>
