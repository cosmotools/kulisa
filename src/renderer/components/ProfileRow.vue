<script setup lang="ts">
// A profile in the profile editor (ProfileEditor.vue; docs/profiles.md). The password is typed, saved and emptied:
// never shown.
import { ref } from 'vue';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, EditableArea, EditableInput, EditablePreview, EditableRoot } from 'reka-ui';
import Avatars from './Avatars.vue';
import { act } from '../lib/store';
import { avatarSrc, plural } from '../lib/common';
import { deleteProfile } from '../lib/profiles';
import type { ClosedProfile, Profile } from '../types';

const props = defineProps<{ p: (Profile & { closed?: false }) | (ClosedProfile & { closed: true; login?: undefined; hasPassword?: undefined }) }>();
const choosing = ref(false);
const passwordError = ref('');

function rename(name?: string | null) {
  const v = (name || '').trim();
  if (v && v !== props.p.name) act('profile:rename', { profile: props.p.id, name: v });
}
// Who it is.
function describe(about?: string | null) {
  if ((about || '').trim() !== (props.p.description || '')) act('profile:describe', { profile: props.p.id, description: about || '' });
}
// A test user's pair (profiles.md, "Test users' sign-ins"): the login saved when the field is left (empty: the pair
// goes); a password typed, saved encrypted, then the field is emptied. The agent signs in with it on a local page.
function saveLogin(user?: string | null) {
  if ((user || '').trim() !== (props.p.login || '')) act('profile:login', { profile: props.p.id, user: user || '' });
}
async function savePassword(e: Event) {
  const password = e.target as HTMLInputElement;
  if (!password.value) return;
  const r = await act<{ error?: string } | null>('profile:login', { profile: props.p.id, user: props.p.login || '', password: password.value });
  password.value = '';
  passwordError.value = r?.error || '';
}
function choose(avatar: string) {
  choosing.value = false;
  if (avatar !== props.p.avatar) act('profile:avatar', { profile: props.p.id, avatar });
}
</script>

<template>
  <CollapsibleRoot v-model:open="choosing" class="prow" :data-profile="p.id">
    <CollapsibleTrigger class="pic icon" title="Change the picture" aria-label="Change the picture"><img class="avatar" alt="" :src="avatarSrc(p.avatar)"></CollapsibleTrigger>
    <div class="who">
      <div class="line">
        <EditableRoot :model-value="p.name" submit-mode="both" select-on-focus :max-length="64" placeholder="Name" @submit="rename">
          <EditableArea class="editable"><EditablePreview class="preview" :title="`The agent calls it ${p.id}`" /><EditableInput class="name" data-name spellcheck="false" aria-label="Name" /></EditableArea>
        </EditableRoot>
        <button class="open" :hidden="!p.closed" @click="act('profile:open', { profile: p.id })">Open</button>
        <button class="del" @click="deleteProfile(p.id)">Delete…</button>
      </div>
      <small class="ntabs">{{ p.closed ? 'closed · ' : '' }}{{ plural(p.closed ? p.tabs : p.tabs.length, 'tab') }}</small>
      <EditableRoot :model-value="p.description || ''" submit-mode="both" :max-length="500" placeholder="About: who this is in your app, for the agent (optional)"
        @submit="describe">
        <EditableArea class="editable"><EditablePreview class="preview" /><EditableInput as="textarea" class="about" rows="2" aria-label="About this profile" /></EditableArea>
      </EditableRoot>
      <div class="line">
        <EditableRoot :model-value="p.login || ''" submit-mode="both" :max-length="200" placeholder="Test login: a test user of your local app (optional)" @submit="saveLogin">
          <EditableArea class="editable"><EditablePreview class="preview" /><EditableInput class="login" spellcheck="false" autocomplete="off" aria-label="Test login" /></EditableArea>
        </EditableRoot>
        <input class="password" type="password" maxlength="500" autocomplete="new-password" aria-label="Test password" :disabled="!p.login"
          :placeholder="passwordError || (p.hasPassword ? 'Password kept (type to change it)' : 'Test password')" @change="savePassword"
          @keydown.enter.prevent="(e) => (e.target as HTMLElement).blur()">
      </div>
      <CollapsibleContent><Avatars :current="p.avatar" @choose="choose" /></CollapsibleContent>
    </div>
  </CollapsibleRoot>
</template>

<style>
/* The profile editor's rows */
.prow { display: flex; gap: var(--inset); align-items: start; padding: 10px 0; border-bottom: 1px solid var(--island-hi);
  .who { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .line { display: flex; gap: var(--inset); align-items: center; }
  .line > :is(:has(> .editable), .password) { flex: 1; min-width: 0; } /* an Editable's root around it */
  .ntabs { padding-inline: 9px; font-size: 0.9em; color: var(--text-muted); }
  .pic { --avatar: 22px; }
}
</style>
