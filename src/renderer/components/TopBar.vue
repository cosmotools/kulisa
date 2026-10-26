<script setup lang="ts">
// The window's title bar (the logo, the tasks' bar when it is there, Settings, ☰) and ☰'s menu (docs/window.md, The
// title bar, Menus). env(titlebar-area-*) leaves room for the OS
// window buttons on every platform (titleBarOverlay in window.ts). Exit only where the OS has no menu bar
// with Quit (not macOS: Cmd+Q there). No logo on macOS: its apps show their icon in the Dock, not by the window's
// buttons.
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import ZoomRow from './menu/ZoomRow.vue';
import ChoiceRow from './menu/ChoiceRow.vue';
import LanguageRow from './menu/LanguageRow.vue';
import ArrangeRow from './menu/ArrangeRow.vue';
import { store } from '../lib/store';
import { keyText, LINKS } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import type { Bar, Theme } from '../../shared/ipc';
import { dialog, openSettings } from '../lib/dialogs';

const mac = kulisa.platform === 'darwin';
const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System', title: 'As the operating system' }];
const BARS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];
const windowMenu = (): MenuItem[] => [
    { component: ZoomRow },
    { component: ChoiceRow, props: { kind: 'theme', icon: 'i-theme', label: 'Theme', choices: THEMES, chosen: () => store.theme,
      choose: (t: string) => kulisa.invoke('theme:set', t as Theme) } }, // one of THEMES
    { component: ChoiceRow, props: { kind: 'bar', icon: 'i-projects', label: 'Tasks bar', choices: BARS, chosen: () => store.bar,
      choose: (b: string) => kulisa.invoke('bar:set', b as Bar) } }, // one of BARS
    { component: LanguageRow },
    '-', { heading: 'Arrange panels', icon: 'i-arrange' }, { component: ArrangeRow }, '-',
    { label: 'Keyboard Shortcuts', icon: 'i-keyboard', keys: keyText('shortcuts'), run: async () => (await dialog('shortcuts')).showShortcuts() },
    '-', ...LINKS.map((l) => ({ label: l.label, icon: l.icon, run: () => open(l.href) })),
    { label: 'Report a Problem…', icon: 'i-bug', title: 'The log of what Kulisa did, and how to send it', run: () => openSettings('log') },
    { label: 'About Kulisa', icon: 'i-logo', run: () => openSettings('about') },
    ...(mac ? [] : ['-' as const, { label: 'Exit', icon: 'i-exit', run: () => kulisa.invoke('app:quit') }])];
</script>

<template>
  <header id="topbar">
    <slot /><!-- the tasks' bar, when it is here (App.vue) -->
    <Icon v-if="!mac" class="logo" data-testid="title-logo" name="i-logo" />
    <span class="drag" data-testid="drag-area" />
    <button id="zoomReset" :hidden="store.zoom === 1" title="Kulisa's zoom. Click to reset (Ctrl 0)" @click="kulisa.invoke('zoom:ui', 0)">{{ Math.round(store.zoom * 100) }}%</button>
    <button id="manageProjects" class="icon" :hidden="!store.projects.settings" title="Settings: projects, agents" aria-label="Settings"
      @click="openSettings()"><Icon name="i-settings" /></button>
    <ButtonMenu :items="windowMenu" end><button id="windowMenu" class="icon" title="Menu: zoom, layout" aria-label="Menu"><Icon name="i-menu" /></button></ButtonMenu>
  </header>
</template>

<style>
#topbar {
  display: flex; gap: var(--gap); align-items: center; height: var(--title);
  /* The area starts after the OS buttons on macOS (at their x) and ends before them elsewhere: the bar is as wide as
     its end, or ☰ stood the buttons' width short of the window's edge on macOS. */
  padding-left: calc(env(titlebar-area-x, 0px) + var(--gap)); width: calc(env(titlebar-area-x, 0px) + env(titlebar-area-width, 100%));
  -webkit-app-region: drag;
  & button { -webkit-app-region: no-drag; &:not(.icon) { padding: 0 14px; } }
  /* The logo and the space after the tasks' bar are where the window is dragged by, however many tabs. Chromium takes
     the tabs scrolled past the bar's edges as no-drag too, over them (not clipped by the bar), and the regions in the
     page's order, the last one winning: so both come after the tasks' bar in the page, the logo put back first by
     order (else neither drags the window with the bar full). The space is at least --drag, as
     Chrome's after its +, and takes what the tabs leave. */
  .logo { order: -1; width: 26px; height: 26px; color: var(--project); }
  .drag { flex: 1 0 var(--drag); align-self: stretch; }
  :is(.logo, .drag) { -webkit-app-region: drag; }
  /* At the right end: the Kulisa zoom, only when not 100%, and ☰, the window's menu, as far from the end of the title
     bar's area (the OS window buttons, or the window's edge on macOS) as the logo from its start. Before it, the
     projects' manager. */
  #manageProjects { --icon: 18px; }
  #windowMenu { --icon: 18px; margin-inline-end: var(--gap); }
}
/* The rows of ☰'s own (menu/*.vue) as the menu's .item: as high, the icon at the start */
.menu {
  :is(.zoomrow, .choicerow, .arrange) [role^="menuitem"] { border-radius: var(--corner);
    &[data-highlighted] { background: var(--island-hi); outline: none; } }
  :is(.zoomrow, .choicerow) { min-height: var(--row); padding-inline: var(--inset) 4px;
    > svg { margin-inline-end: calc(var(--inset) - 2px); } }
}
</style>
