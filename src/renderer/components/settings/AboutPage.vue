<script setup lang="ts">
// The About page of Settings (docs/window.md, Menus, About Kulisa; the guide, "Where Kulisa keeps things"): the versions,
// and the folders Kulisa writes in as this computer has them (the OS and its variables decide where appData is: issue
// #67), each opened in the file manager, its path there to copy. Asked of the main process each time the page is
// shown, so a folder made since shows. A dialog until 2026-10-18 (About.vue): as Chrome's About, a page of the
// settings, one place for what is about the app.
import { ref, watch } from 'vue';
import Icon from '../Icon.vue';
import type { AboutInfo, AboutFolder } from '../../../shared/types';

const props = defineProps<{ shown: boolean }>(); // the page chosen in the tree
const FOLDERS: Record<AboutFolder, { label: string; hint: string }> = {
  data: { label: 'Data', hint: 'Profiles with their sign-ins, agents\' accounts, projects\' tasks, settings, the log.' },
  projects: { label: 'Projects', hint: 'New projects, and the copies of the code of tasks of a project of several repositories.' },
  program: { label: 'Program', hint: 'The program as installed, or the checkout it runs from. Uninstalling removes it; the folders above stay.' },
};
const info = ref<AboutInfo | null>(null);
watch(() => props.shown, async (s) => { if (s) info.value = await kulisa.invoke('about:get'); }, { immediate: true });
</script>

<template>
  <div id="aboutpage">
    <template v-if="info">
      <div class="who">
        <Icon name="i-logo" />
        <div>
          <h3>Kulisa <span class="version">{{ info.version }}</span></h3>
          <p class="hint">Electron {{ info.electron }} · Chromium {{ info.chrome }}</p>
          <p class="hint"><a href="https://kulisa.app">kulisa.app</a> · GPL-3.0-or-later</p>
        </div>
      </div>
      <h3 class="titled">Where Kulisa keeps things</h3>
      <dl class="paths">
        <template v-for="f in info.folders" :key="f.id">
          <dt>{{ FOLDERS[f.id].label }}</dt>
          <dd :class="{ missing: !f.exists }" :data-folder="f.id">
            <span class="path">{{ f.path }}</span>
            <button class="icon show" :disabled="!f.exists" :title="f.exists ? 'Show in your file manager' : 'Not made yet'" aria-label="Show"
              @click="kulisa.invoke('about:show-folder', f.id)"><Icon name="i-folder" /></button>
            <span class="hint">{{ FOLDERS[f.id].hint }}</span>
          </dd>
        </template>
      </dl>
    </template>
  </div>
</template>

<style>
#aboutpage { max-width: 640px;
  .who { display: flex; align-items: center; gap: var(--gap); margin-bottom: calc(var(--gap) * 2);
    > svg { width: 48px; height: 48px; flex: none; color: var(--project); }
    h3 { margin: 0 0 2px; font-size: var(--font-lead); font-weight: 600; color: var(--text-strong); }
    .version { font-weight: normal; color: var(--text-dim); }
    .hint { margin: 0; } }
  .paths { display: grid; grid-template-columns: auto 1fr; gap: 0 var(--gap); margin: var(--inset) 0 0;
    dt { padding-top: 8px; color: var(--text-dim); }
    dd { display: grid; grid-template-columns: 1fr auto; align-items: center; margin: 0; padding: 4px 0; border-bottom: 1px solid var(--island-hi);
      .path { color: var(--text-strong); overflow-wrap: anywhere; user-select: text; cursor: text; }
      .hint { grid-column: 1 / -1; margin: 0 0 2px; } }
    .missing .path { color: var(--text-muted); } }
}
</style>
