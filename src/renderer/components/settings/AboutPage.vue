<script setup lang="ts">
// The About page of Settings (docs/window.md, Menus, About Kulisa; the guide, "Where Kulisa keeps things"): the versions,
// and the folders Kulisa writes in as this computer has them (the OS and its variables decide where appData is: issue
// #67), each opened in the file manager, its path there to copy. Asked of the main process each time the page is
// shown, so a folder made since shows. As Chrome's About, a page of the settings: one place for what is about the app.
import { ref, watch } from 'vue';
import type { AboutInfo, AboutFolder } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { FolderIcon } from '@lucide/vue';
import LogoMark from '../marks/LogoMark.vue';

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
  <div id="aboutpage" class="flex max-w-2xl flex-col gap-4">
    <template v-if="info">
      <Card>
        <CardHeader class="grid-cols-[auto_1fr] gap-x-4">
          <LogoMark class="row-span-2 size-12 text-primary" />
          <CardTitle class="text-lg">Kulisa <span class="font-normal text-muted-foreground" data-testid="version">{{ info.version }}</span></CardTitle>
          <CardDescription>Electron {{ info.electron }} · Chromium {{ info.chrome }}<br><a href="https://kulisa.app">kulisa.app</a> · GPL-3.0-or-later</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader><CardTitle>Where Kulisa keeps things</CardTitle></CardHeader>
        <CardContent>
          <ItemGroup>
            <Item v-for="f in info.folders" :key="f.id" size="xs" :data-folder="f.id" :data-missing="!f.exists || undefined">
              <ItemContent class="min-w-0">
                <ItemTitle>{{ FOLDERS[f.id].label }}</ItemTitle>
                <p class="cursor-text font-mono text-xs wrap-anywhere select-text" :class="f.exists ? 'text-foreground' : 'text-muted-foreground'" data-testid="path">{{ f.path }}</p>
                <ItemDescription>{{ FOLDERS[f.id].hint }}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="icon-sm" :disabled="!f.exists" :title="f.exists ? 'Show in your file manager' : 'Not made yet'" aria-label="Show"
                  @click="kulisa.invoke('about:show-folder', f.id)"><FolderIcon /></Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
