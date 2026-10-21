<script setup lang="ts">
// A profile's page in Settings (docs/profiles.md): who it is, each field saved as it changes (on
// Enter or leaving it). Sign In… opens its master's window (master.ts), to sign in once for every task. Settings'
// tree makes and deletes profiles (ProjectEditor.vue); a project's page adds and removes them there.
import { ref, watch } from 'vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import Icon from '../Icon.vue';
import Avatars from './Avatars.vue';
import { avatarSrc } from '../../lib/common';
import { covered } from '../../lib/cover';
import { focusBack } from '../../lib/menu';
import { refused } from '../../../shared/result';
import type { Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';

const props = defineProps<{ profile: SettingsProfile }>();
// changed: the profiles as they are now, and its id (renamed: a new one).
const emit = defineEmits<{ changed: [r: { profiles: SettingsProfile[]; id?: string }] }>();
const error = ref('');
// The fields as typed, saved on Enter or leaving them (a name refused stays typed, with why under it).
const name = ref(''), about = ref(''), login = ref(''), password = ref('');
// The fields of the one shown, again when another is chosen or it changed elsewhere.
watch(() => props.profile, (p) => {
  name.value = p.name; about.value = p.description; login.value = p.login; password.value = ''; error.value = '';
}, { immediate: true });
// A change to who it is, what Settings answers (main/ipc/profiles.ts).
async function change(answer: Promise<Result<{ profiles: SettingsProfile[]; id: string }>>) {
  const r = await answer;
  error.value = refused(r) ? r.error : '';
  if (!refused(r)) emit('changed', r);
  return !refused(r);
}
const p = () => props.profile;
const pid = () => p().id;
const rename = () => { if (name.value.trim() !== p().name) void change(kulisa.invoke('profiles:rename', { profile: pid(), name: name.value })); };
const describe = () => { if (about.value.trim() !== p().description) void change(kulisa.invoke('profiles:describe', { profile: pid(), description: about.value })); };
const saveLogin = () => { if (login.value.trim() !== p().login) void change(kulisa.invoke('profiles:login', { profile: pid(), user: login.value })); };
async function savePassword() {
  if (password.value && (await change(kulisa.invoke('profiles:login', { profile: pid(), user: login.value, password: password.value })))) password.value = '';
}
// Its picture: a panel of them from the button beside it (a menu's look, the pages pictures meanwhile).
const { open: picking, ready: pickReady } = covered('pictures');
let pickFocused: Element | null = null;
const togglePick = (v: boolean) => { if (v) pickFocused = document.activeElement; picking.value = v; };
async function pick(avatar: string) { picking.value = false; await change(kulisa.invoke('profiles:avatar', { profile: pid(), avatar })); }
async function signIn() { error.value = (await kulisa.invoke('profiles:master', { profile: props.profile.id }))?.error || ''; }
</script>

<template>
  <div id="profilepage">
    <div class="field"><span>Picture:</span><span>
      <PopoverRoot :open="picking" @update:open="togglePick">
        <PopoverTrigger as-child><button id="profilepic" class="select" type="button" title="Its picture" aria-label="Picture">
          <img class="avatar" alt="" :src="avatarSrc(profile.avatar)"><Icon name="i-down" /></button></PopoverTrigger>
        <PopoverPortal>
          <PopoverContent class="menu profilepics" :class="{ ready: pickReady }" align="start" :side-offset="4" :collision-padding="4"
            @close-auto-focus="focusBack($event, pickFocused)"><Avatars :current="profile.avatar" @choose="pick" /></PopoverContent>
        </PopoverPortal>
      </PopoverRoot></span></div>
    <div class="field"><label for="profilename">Name:</label><input id="profilename" v-model="name" data-name maxlength="64" spellcheck="false"
      :title="`The agent calls it ${profile.id}`" @change="rename" @keydown.enter.prevent="rename"></div>
    <div class="field top"><label for="profileabout">About:</label><textarea id="profileabout" v-model="about" rows="2" maxlength="500"
      placeholder="e.g. seller in the Acme shop; can approve refunds" @change="describe" /></div>
    <p class="hint">The agent reads this to choose the profile for a task, and asks you when it is empty.</p>
    <div class="field"><label for="profilelogin">Test login:</label><input id="profilelogin" v-model="login" maxlength="200" spellcheck="false" autocomplete="off"
      placeholder="A test user of your local app (optional)" @change="saveLogin" @keydown.enter.prevent="saveLogin"></div>
    <div class="field"><label for="profilepassword">Test password:</label><input id="profilepassword" v-model="password" type="password" maxlength="500"
      autocomplete="new-password" :disabled="!profile.login" :placeholder="profile.hasPassword ? 'Kept (type to change it)' : 'Test password'"
      @change="savePassword" @keydown.enter.prevent="savePassword"></div>
    <p class="hint">Kulisa types them itself, on local addresses only; the agent never sees the password.</p>
    <div class="field"><span>Sign-ins:</span><span><button id="profilesignin" type="button" @click="signIn">Sign In…</button></span></div>
    <p class="hint">In a window of its own, once for every task of its projects.</p>
    <div class="field"><span>Projects:</span><span class="projects">{{ profile.projects.join(', ') || 'none: add it on a project\'s page' }}</span></div>
    <p id="profileerror" class="error">{{ error }}</p>
  </div>
</template>

<style>
#profilepage { display: flex; flex-direction: column; gap: var(--gap);
  .field { margin: 0; } .field.top { align-items: start; > label { line-height: var(--control); } }
  .hint { margin: -4px 0 0 calc(var(--label) + var(--inset)); }
  textarea { width: 100%; }
  #profilepic { width: auto; gap: 4px; padding: 0 6px; .avatar { --avatar: 18px; } }
  .projects { color: var(--text-dim); }
  .error:empty { display: none; }
}
.profilepics { min-width: 0; padding: var(--gap); .choices { max-width: 320px; } }
</style>
