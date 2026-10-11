<script setup lang="ts">
// Settings → Profiles (docs/profiles.md; the author, 2026-10-11), as Settings → Agents: every profile on the left, the
// chosen one's fields on the right, each saved as it changes (a field on Enter or leaving it). A profile lives until it
// is deleted here (− , asked first); a project's page adds and removes it there. Sign In… opens its master's window
// (master.js), to sign in once for every task.
import { nextTick, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import Icon from './Icon.vue';
import Avatars from './Avatars.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import { avatarSrc } from '../lib/common';
import { covered } from '../lib/views';
import { focusBack, type MenuItem } from '../lib/menu';
import type { SettingsProfile } from '../types';

const props = defineProps<{ active: boolean; at?: string | null }>();
const profiles = ref<SettingsProfile[]>([]), chosen = ref<string>(), error = ref('');
const adding = ref(false), newName = ref(''), newField = ref<HTMLInputElement>();
// The fields as typed, saved on Enter or leaving them (a name refused stays typed, with why under it).
const name = ref(''), about = ref(''), login = ref(''), password = ref('');
const show = (r: { profiles?: SettingsProfile[]; error?: string | null; id?: string }) => {
  if (r.error) { error.value = r.error; return false; }
  error.value = '';
  if (r.profiles) profiles.value = r.profiles;
  if (r.id) chosen.value = r.id;
  if (!profiles.value.some((p) => p.id === chosen.value)) chosen.value = profiles.value[0]?.id;
  return true;
};
const current = () => profiles.value.find((p) => p.id === chosen.value);
// The fields of the one chosen, again when another is chosen or it changed elsewhere.
watch([chosen, profiles], () => {
  const p = current();
  name.value = p?.name ?? ''; about.value = p?.description ?? ''; login.value = p?.login ?? ''; password.value = '';
});
async function load(at?: string | null) {
  show(await kulisa.invoke('profiles:list'));
  if (at && profiles.value.some((p) => p.id === at)) chosen.value = at;
}
watch(() => [props.active, props.at] as const, ([on, at]) => { if (on) load(at); }, { immediate: true });

const change = async (channel: string, args: Record<string, unknown>) => show(await kulisa.invoke(channel, { profile: chosen.value, ...args }));
const rename = () => { const p = current(); if (p && name.value.trim() !== p.name) change('profiles:rename', { name: name.value }); };
const describe = () => { const p = current(); if (p && about.value.trim() !== p.description) change('profiles:describe', { description: about.value }); };
const saveLogin = () => { const p = current(); if (p && login.value.trim() !== p.login) change('profiles:login', { user: login.value }); };
async function savePassword() {
  if (!password.value || !current()) return;
  if (await change('profiles:login', { user: login.value, password: password.value })) password.value = '';
}
// Its picture: a panel of them from the button beside it (a menu's look, the pages pictures meanwhile).
const { open: picking, ready: pickReady } = covered('pictures');
let pickFocused: Element | null = null;
const togglePick = (v: boolean) => { if (v) pickFocused = document.activeElement; picking.value = v; };
async function pick(avatar: string) { picking.value = false; await change('profiles:avatar', { avatar }); }

// + : its name typed in place under the list, Create makes it (in no project; a project's page adds it there).
async function startAdding() { adding.value = true; newName.value = ''; await nextTick(); newField.value?.focus(); }
async function create() {
  if (!newName.value.trim()) return newField.value?.focus();
  if (show(await kulisa.invoke('profiles:new', { name: newName.value }))) adding.value = false;
}
// − , Delete, or a row's right-click: deleted after a question, everywhere (its copies in every task, its master).
async function remove(id = chosen.value) { if (id) show(await kulisa.invoke('profiles:delete', { profile: id })); }
const rowMenu = (e: MouseEvent): MenuItem[] | null => {
  const id = (e.target as Element).closest<HTMLElement>('[data-profile]')?.dataset.profile;
  if (!id) return null;
  chosen.value = id;
  return [{ label: 'Delete…', run: () => remove(id) }];
};
const signIn = () => change('profiles:master', {});
</script>

<template>
  <div id="profilestab">
    <div class="list profilenav">
      <div class="tools">
        <button id="profilenew" class="icon small" type="button" title="New Profile…" aria-label="New Profile" @click="startAdding"><Icon name="i-plus" /></button>
        <button id="profiledel" class="icon small" type="button" title="Delete the profile (asks first)" aria-label="Delete the profile" :disabled="!chosen" @click="remove()"><Icon name="i-minus" /></button>
      </div>
      <RightClickMenu :items="rowMenu">
        <ListboxRoot v-if="profiles.length" v-model="chosen" selection-behavior="replace" aria-label="Profiles" @keydown.delete="remove()">
          <ListboxContent>
            <ListboxItem v-for="p in profiles" :key="p.id" :value="p.id" class="item" :data-profile="p.id">
              <img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span class="text"><span class="label">{{ p.name }}</span></span>
              <kbd v-if="!p.projects.length">no project</kbd>
            </ListboxItem>
          </ListboxContent>
        </ListboxRoot>
      </RightClickMenu>
      <p v-if="!profiles.length && !adding" class="empty">No profiles yet.</p>
    </div>
    <div class="profilepage">
      <!-- Enter makes it; Esc puts it away -->
      <div v-if="adding" id="profileadding" class="field"><label for="profilenewname">New profile:</label><span class="pick">
        <input id="profilenewname" ref="newField" v-model="newName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com" spellcheck="false"
          @keydown.enter.prevent="create" @keydown.esc.stop.prevent="adding = false">
        <button type="button" @click="adding = false">Cancel</button><button id="profilecreate" class="primary" type="button" @click="create">Create</button></span></div>
      <template v-if="current()">
        <div class="field"><span>Picture:</span><span>
          <PopoverRoot :open="picking" @update:open="togglePick">
            <PopoverTrigger as-child><button id="profilepic" class="select" type="button" title="Its picture" aria-label="Picture">
              <img class="avatar" alt="" :src="avatarSrc(current()!.avatar)"><Icon name="i-down" /></button></PopoverTrigger>
            <PopoverPortal>
              <PopoverContent class="menu profilepics" :class="{ ready: pickReady }" align="start" :side-offset="4" :collision-padding="4"
                @close-auto-focus="focusBack($event, pickFocused)"><Avatars :current="current()!.avatar" @choose="pick" /></PopoverContent>
            </PopoverPortal>
          </PopoverRoot></span></div>
        <div class="field"><label for="profilename">Name:</label><input id="profilename" v-model="name" data-name maxlength="64" spellcheck="false"
          :title="`The agent calls it ${current()!.id}`" @change="rename" @keydown.enter.prevent="rename"></div>
        <div class="field top"><label for="profileabout">About:</label><textarea id="profileabout" v-model="about" rows="2" maxlength="500"
          placeholder="e.g. seller in the Acme shop; can approve refunds" @change="describe" /></div>
        <p class="hint">The agent reads this to choose the profile for a task, and asks you when it is empty.</p>
        <div class="field"><label for="profilelogin">Test login:</label><input id="profilelogin" v-model="login" maxlength="200" spellcheck="false" autocomplete="off"
          placeholder="A test user of your local app (optional)" @change="saveLogin" @keydown.enter.prevent="saveLogin"></div>
        <div class="field"><label for="profilepassword">Test password:</label><input id="profilepassword" v-model="password" type="password" maxlength="500"
          autocomplete="new-password" :disabled="!current()!.login" :placeholder="current()!.hasPassword ? 'Kept (type to change it)' : 'Test password'"
          @change="savePassword" @keydown.enter.prevent="savePassword"></div>
        <p class="hint">Kulisa types them itself, on local addresses only; the agent never sees the password.</p>
        <div class="field"><span>Sign-ins:</span><span><button id="profilesignin" type="button" @click="signIn">Sign In…</button></span></div>
        <p class="hint">In a window of its own, once for every task of its projects.</p>
        <div class="field"><span>Projects:</span><span class="projects">{{ current()!.projects.join(', ') || 'none: add it on a project\'s page' }}</span></div>
      </template>
      <p id="profileserror" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style>
/* The profiles on the left, the chosen one's fields on the right (as Settings → Agents) */
#profilestab { display: flex; gap: var(--inset); align-items: start; min-height: 0;
  .profilenav { flex: none; width: 220px; .avatar { --avatar: 18px; } }
  .profilepage { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--gap);
    .field { margin: 0; } .field.top { align-items: start; > label { line-height: var(--control); } }
    .hint { margin: -4px 0 0 calc(var(--label) + var(--inset)); }
    textarea { width: 100%; }
    #profilepic { width: auto; gap: 4px; padding: 0 6px; .avatar { --avatar: 18px; } }
    .projects { color: var(--text-dim); }
    .error:empty { display: none; } }
}
.profilepics { min-width: 0; padding: var(--gap); .choices { max-width: 320px; } }
</style>
