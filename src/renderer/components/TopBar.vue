<script setup lang="ts">
// The window's title bar and ☰ (docs/window.md, The title bar, Menus). env(titlebar-area-*) leaves room for the OS
// window buttons on every platform (titleBarOverlay in window.js). Exit only where the OS has no menu bar
// with Quit (not macOS: Cmd+Q there).
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import ZoomRow from './menu/ZoomRow.vue';
import ChoiceRow from './menu/ChoiceRow.vue';
import ArrangeRow from './menu/ArrangeRow.vue';
import { store } from '../lib/store';
import { keyText, LINKS, version } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import { dialog } from '../lib/dialogs';

const THEMES = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System', title: 'As the operating system' }];
const BARS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];
const windowMenu = (): MenuItem[] => [
    { component: ZoomRow },
    { component: ChoiceRow, props: { kind: 'theme', icon: 'i-theme', label: 'Theme', choices: THEMES, chosen: () => store.theme,
      choose: (t: string) => kulisa.invoke('theme:set', t) } },
    { component: ChoiceRow, props: { kind: 'bar', icon: 'i-projects', label: 'Projects bar', choices: BARS, chosen: () => store.bar,
      choose: (b: string) => kulisa.invoke('bar:set', b) } },
    '-', { heading: 'Arrange panels', icon: 'i-arrange' }, { component: ArrangeRow }, '-',
    { label: 'Agents…', icon: 'i-agent', run: async () => (await dialog('projects')).openAgents() },
    { label: 'Keyboard Shortcuts', icon: 'i-keyboard', keys: keyText('shortcuts'), run: async () => (await dialog('shortcuts')).showShortcuts() },
    '-', ...LINKS.map((l) => ({ label: l.label, icon: l.icon, run: () => open(l.href) })),
    ...(kulisa.platform === 'darwin' ? [] : ['-' as const, { label: 'Exit', icon: 'i-exit', run: () => kulisa.invoke('app:quit') }]),
    { note: `Kulisa ${version}` }];
</script>

<template>
  <header id="topbar">
    <Icon class="logo" name="i-logo" />
    <button id="zoomReset" :hidden="store.zoom === 1" title="Kulisa's zoom. Click to reset (Ctrl 0)" @click="kulisa.invoke('zoom:ui', 0)">{{ Math.round(store.zoom * 100) }}%</button>
    <button id="manageProjects" class="icon" title="Settings: projects, agents" aria-label="Settings"
      @click="dialog('projects').then((d) => d.openProjects())"><Icon name="i-settings" /></button>
    <ButtonMenu :items="windowMenu" end><button id="windowMenu" class="icon" title="Menu: zoom, layout" aria-label="Menu"><Icon name="i-menu" /></button></ButtonMenu>
  </header>
</template>

<style>
#topbar {
  display: flex; gap: var(--gap); align-items: center; flex: none; height: 44px;
  padding-left: calc(env(titlebar-area-x, 0px) + var(--gap)); width: env(titlebar-area-width, 100%);
  -webkit-app-region: drag;
  & button { -webkit-app-region: no-drag; &:not(.icon) { padding: 0 14px; } }
  .logo { width: 26px; height: 26px; color: var(--project); }
  /* At the right end: the Kulisa zoom, only when not 100%, and ☰, the window's menu, as far from the end of the title
     bar's area (the OS window buttons, or the window's edge on macOS) as the logo from its start. Before it, the
     projects' manager. */
  #zoomReset { margin-inline-start: auto; }
  #manageProjects { --icon: 18px; margin-inline-start: auto;
    #zoomReset:not([hidden]) + & { margin-inline-start: 0; } }
  #windowMenu { --icon: 18px; margin-inline-end: var(--gap); }
}
/* The rows of ☰'s own (menu/*.vue) as the menu's .item: as high, the icon at the start */
.menu {
  :is(.zoomrow, .themerow, .barrow, .arrange) [role^="menuitem"] { border-radius: var(--radius);
    &[data-highlighted] { background: var(--island-hi); outline: none; } }
  :is(.zoomrow, .themerow, .barrow) { min-height: var(--row); padding-inline: var(--inset) 4px;
    > svg { margin-inline-end: calc(var(--inset) - 2px); } }
}
</style>
