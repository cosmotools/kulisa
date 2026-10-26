<script setup lang="ts">
// A profile's panel's header in the grid (docs/profiles.md): its picture, name, the agent's caption, the profile's menu
// (⋯, as its right-click), ×.
import { computed } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import { avatarSrc, keyText } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes } from '../../lib/grid';
import { openSettings } from '../../lib/dialogs';
import { deleteProfile } from '../../lib/profiles';
import { EllipsisIcon, XIcon } from '@lucide/vue';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const key = props.params.api.id.slice('profile:'.length);
const profile = computed(() => store.profiles.find((p) => p.id === key));
const caption = computed(() => (profile.value?.signinMode ? '🔒 Sign-in page — agent paused' : store.captions[profile.value?.id || ''] || ''));

function menu(): MenuItem[] | null {
  const p = profile.value;
  if (!p) return null;
  return [
    { label: 'New tab', keys: keyText('tab.new'), run: () => panes.get(key)?.newTab() },
    { label: 'About this profile…', run: () => openSettings('profiles', p.id) },
    { label: 'Sign In to Master…', run: () => act('profile:master', { profile: p.id }) },
    { label: 'Close profile', run: () => act('profile:close', { profile: p.id }) },
    '-',
    { label: 'Remove from Project…', run: () => deleteProfile(p.id) },
  ];
}
</script>

<template>
  <RightClickMenu :items="menu"><div class="flex h-full min-w-0 items-center gap-1.5 px-2" :data-panel="params.api.id">
    <template v-if="profile">
      <Avatar size="sm"><AvatarImage :src="avatarSrc(profile.avatar)" alt="" /></Avatar><b class="min-w-0 truncate font-medium" data-testid="profile-name"
        :title="[profile.name, profile.description].filter(Boolean).join('\n')">{{ profile.name }}</b>
      <span class="min-w-0 flex-1 truncate text-muted-foreground" role="status">{{ caption }}</span>
      <ButtonMenu :items="() => menu() ?? []" end><Button variant="ghost" size="icon-xs" title="The profile's menu" aria-label="Profile menu"><EllipsisIcon /></Button></ButtonMenu>
      <Button variant="ghost" size="icon-xs" title="Close profile: its tabs go, its sign-ins stay (open it again in Profiles)" aria-label="Close profile"
        @click="act('profile:close', { profile: profile.id })"><XIcon /></Button>
    </template>
  </div></RightClickMenu>
</template>
