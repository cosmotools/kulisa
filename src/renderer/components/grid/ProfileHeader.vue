<script setup lang="ts">
// A profile's panel's header in the grid (docs/profiles.md).
import { computed } from 'vue';
import type { DockviewPanelApi } from 'dockview-vue';
import Icon from '../Icon.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import { act, store } from '../../lib/store';
import { avatarSrc, keyText } from '../../lib/common';
import type { MenuItem } from '../../lib/menu';
import { panes } from '../../lib/grid';
import { openSettings } from '../../lib/dialogs';
import { deleteProfile } from '../../lib/profiles';

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
  <RightClickMenu :items="menu"><div class="ptab" :data-panel="params.api.id">
    <template v-if="profile">
      <img class="avatar" alt="" :src="avatarSrc(profile.avatar)"><b class="pname"
        :title="[profile.name, profile.description].filter(Boolean).join('\n')">{{ profile.name }}</b>
      <span class="caption">{{ caption }}</span>
      <button class="close icon quiet" title="Close profile: its tabs go, its sign-ins stay (open it again in Profiles)" aria-label="Close profile"
        @click="act('profile:close', { profile: profile.id })"><Icon name="i-close" /></button>
    </template>
  </div></RightClickMenu>
</template>

<style>
/* A pane narrower than its name: the header shrinks with it (else it ran past the pane, its × out of sight and
   dockview's list of hidden tabs shown for it), the name cut with …, the × kept. */
#dock .dv-tab:has(.ptab) { min-width: 0; flex-shrink: 1; }
.pname { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.caption { flex: 1 1 0; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--agent); font-weight: normal; }
</style>
