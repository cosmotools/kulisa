<script setup lang="ts">
// A profile's panel's header in the grid: its picture, its name (who it is on hover), what the agent does there (its
// caption; 🔒 on a sign-in page, where the agent is paused), × closing the profile (its tabs go, its sign-ins stay).
// Its right-click menu: New tab, About this profile…, Sign In to Master… (its master's window: signed in there, every
// task's copy is too), Refresh from Master…, Close profile, Delete profile….
import { computed } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import { avatarSrc, keyText } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes } from '../../lib/grid';
import { dialog } from '../../lib/dialogs';
import { deleteProfile } from '../../lib/profiles';

const props = defineProps<{ params: { api: DockviewPanelApi } }>();
const key = props.params.api.id.slice('profile:'.length);
const profile = computed(() => store.profiles.find((p) => p.key === key));
const caption = computed(() => (profile.value?.signinMode ? '🔒 Sign-in page — agent paused' : store.captions[profile.value?.id || ''] || ''));

function menu(): MenuItem[] | null {
  const p = profile.value;
  if (!p) return null;
  return [
    { label: 'New tab', keys: keyText('tab.new'), run: () => panes.get(key)?.newTab() },
    { label: 'About this profile…', run: async () => (await dialog('profiles')).about(key) },
    { label: 'Sign In to Master…', run: () => act('profile:master', { profile: p.id }) },
    { label: 'Refresh from Master…', run: () => act('profile:refresh', { profile: p.id }) },
    { label: 'Close profile', run: () => act('profile:close', { profile: p.id }) },
    '-',
    { label: 'Delete profile…', run: () => deleteProfile(p.id) },
  ];
}
</script>

<template>
  <RightClickMenu :items="menu"><div class="ptab" :data-panel="params.api.id">
    <template v-if="profile">
      <img class="avatar" alt="" :src="avatarSrc(profile.avatar)"><b class="pname" :title="profile.description || ''">{{ profile.name }}</b>
      <span class="caption">{{ caption }}</span>
      <button class="close icon quiet" title="Close profile: its tabs go, its sign-ins stay (open it again in Profiles)" aria-label="Close profile"
        @click="act('profile:close', { profile: profile.id })"><Icon name="i-close" /></button>
    </template>
  </div></RightClickMenu>
</template>

<style>
.pname { white-space: nowrap; }
.caption { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--note); font-weight: normal; }
</style>
