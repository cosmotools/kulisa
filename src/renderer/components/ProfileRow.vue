<script setup lang="ts">
// A profile in the profile editor (ProfileEditor.vue): its picture (a click shows the others), its name, how many tabs,
// who it is, a test user's login and password; Open for a closed one, Delete…. Each saved when its field is left
// (Enter too; Shift+Enter a new line in who it is); Esc puts back what was saved.
import { ref } from 'vue';
import Avatars from './Avatars.vue';
import { act } from '../lib/store';
import { avatarSrc, plural } from '../lib/common';
import { deleteProfile } from '../lib/profiles';
import type { ClosedProfile, Profile } from '../types';

const props = defineProps<{ p: (Profile & { closed?: false }) | (ClosedProfile & { closed: true; login?: undefined; hasPassword?: undefined }) }>();
const choosing = ref(false);
const passwordError = ref('');
const leave = (e: Event) => (e.target as HTMLElement).blur();

function rename(e: Event) {
  const input = e.target as HTMLInputElement, v = input.value.trim();
  if (v && v !== props.p.name) act('profile:rename', { profile: props.p.id, name: v });
  else input.value = props.p.name;
}
function nameKey(e: KeyboardEvent) {
  const input = e.target as HTMLInputElement;
  if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); input.value = props.p.name; input.blur(); }
}
// Who it is.
function describe(e: Event) {
  const about = e.target as HTMLTextAreaElement;
  if (about.value.trim() !== (props.p.description || '')) act('profile:describe', { profile: props.p.id, description: about.value });
}
function aboutKey(e: KeyboardEvent) {
  const about = e.target as HTMLTextAreaElement;
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); about.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); about.value = props.p.description || ''; about.blur(); }
}
// A test user's pair (profiles.md, "Test users' sign-ins"): the login saved when the field is left (empty: the pair
// goes); a password typed, saved encrypted, then the field is emptied. The agent signs in with it on a local page.
const login = ref<HTMLInputElement>();
function saveLogin(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (v.trim() !== (props.p.login || '')) act('profile:login', { profile: props.p.id, user: v });
}
async function savePassword(e: Event) {
  const password = e.target as HTMLInputElement;
  if (!password.value) return;
  const r = await act<{ error?: string } | null>('profile:login', { profile: props.p.id, user: login.value!.value, password: password.value });
  password.value = '';
  passwordError.value = r?.error || '';
}
function choose(avatar: string) {
  choosing.value = false;
  if (avatar !== props.p.avatar) act('profile:avatar', { profile: props.p.id, avatar });
}
</script>

<template>
  <div class="prow" :data-profile="p.id">
    <button class="pic icon" type="button" title="Change the picture" aria-label="Change the picture" :aria-expanded="choosing"
      @click="choosing = !choosing"><img class="avatar" alt="" :src="avatarSrc(p.avatar)"></button>
    <div class="who">
      <div class="line">
        <input class="name" data-name maxlength="64" spellcheck="false" aria-label="Name" :value="p.name" :title="`The agent calls it ${p.id}`"
          @change="rename" @keydown="nameKey">
        <button class="open" :hidden="!p.closed" @click="act('profile:open', { profile: p.id })">Open</button>
        <button class="del" @click="deleteProfile(p.id)">Delete…</button>
      </div>
      <small class="ntabs">{{ p.closed ? 'closed · ' : '' }}{{ plural(p.closed ? p.tabs : p.tabs.length, 'tab') }}</small>
      <textarea class="about" rows="2" maxlength="500" aria-label="About this profile" placeholder="About: who this is in your app, for the agent (optional)"
        :value="p.description || ''" @change="describe" @keydown="aboutKey" />
      <div class="line">
        <input ref="login" class="login" maxlength="200" spellcheck="false" autocomplete="off" aria-label="Test login"
          placeholder="Test login: a test user of your local app (optional)" :value="p.login || ''" @change="saveLogin" @keydown.enter.prevent="leave">
        <input class="password" type="password" maxlength="500" autocomplete="new-password" aria-label="Test password" :disabled="!p.login"
          :placeholder="passwordError || (p.hasPassword ? 'Password kept (type to change it)' : 'Test password')" @change="savePassword" @keydown.enter.prevent="leave">
      </div>
      <Avatars :hidden="!choosing" :current="p.avatar" @choose="choose" />
    </div>
  </div>
</template>

<style>
/* The profile editor's rows */
.prow { display: flex; gap: var(--inset); align-items: start; padding: 10px 0; border-bottom: 1px solid var(--island-hi);
  .who { flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .line { display: flex; gap: var(--inset); align-items: center; }
  :is(.name, .login, .password) { flex: 1; min-width: 0; }
  .ntabs { padding-inline: 9px; font-size: 0.9em; color: var(--text-muted); }
  .pic { --avatar: 22px; }
}
</style>
