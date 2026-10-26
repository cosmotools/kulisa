<script setup lang="ts">
// A profile's page in Settings (docs/profiles.md): who it is, each field saved as it changes (on
// Enter or leaving it). Sign In… opens its master's window (master.ts), to sign in once for every task. Settings'
// tree makes and deletes profiles (ProjectEditor.vue); a project's page adds and removes them there.
import { ref, watch } from 'vue';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import Avatars from './Avatars.vue';
import { avatarSrc } from '../../lib/common';
import { covered } from '../../lib/cover';
import { focusBack } from '../../lib/menu';
import { refused } from '../../../shared/result';
import type { Result } from '../../../shared/result';
import type { SettingsProfile } from '../../../shared/types';
import { ChevronDownIcon } from '@lucide/vue';

const props = defineProps<{ profile: SettingsProfile }>();
// changed: the profiles as they are now, and its id.
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
// Its picture: a panel of them from the button beside it (the pages pictures meanwhile).
const { open: picking, ready: pickReady } = covered('pictures');
let pickFocused: Element | null = null;
const togglePick = (v: boolean) => { if (v) pickFocused = document.activeElement; picking.value = v; };
async function pick(avatar: string) { picking.value = false; await change(kulisa.invoke('profiles:avatar', { profile: pid(), avatar })); }
async function signIn() { error.value = (await kulisa.invoke('profiles:master', { profile: props.profile.id }))?.error || ''; }
</script>

<template>
  <FieldGroup id="profilepage" class="max-w-xl">
    <Field>
      <FieldLabel for="profilepic">Picture</FieldLabel>
      <!-- In a box of its own: a field's parts are as wide as the field -->
      <div><Popover :open="picking" @update:open="togglePick">
        <PopoverTrigger as-child><Button id="profilepic" variant="outline" title="Its picture" aria-label="Picture">
          <Avatar class="size-5"><AvatarImage :src="avatarSrc(profile.avatar)" alt="" /></Avatar><ChevronDownIcon /></Button></PopoverTrigger>
        <PopoverContent :data-ready="pickReady || undefined" aria-label="Pictures" align="start" class="w-80 not-data-ready:opacity-0" @close-auto-focus="focusBack($event, pickFocused)">
          <Avatars :current="profile.avatar" @choose="pick" />
        </PopoverContent>
      </Popover></div>
    </Field>
    <Field>
      <FieldLabel for="profilename">Name</FieldLabel>
      <Input id="profilename" v-model="name" data-name maxlength="64" spellcheck="false"
        title="The agent calls it by this name: no other profile of its projects has it" @change="rename" @keydown.enter.prevent="rename" />
    </Field>
    <Field>
      <FieldLabel for="profileabout">About</FieldLabel>
      <Textarea id="profileabout" v-model="about" rows="2" maxlength="500" placeholder="e.g. seller in the Acme shop; can approve refunds" @change="describe" />
      <FieldDescription>The agent reads this to choose the profile for a task, and asks you when it is empty.</FieldDescription>
    </Field>
    <Field>
      <FieldLabel for="profilelogin">Test login</FieldLabel>
      <Input id="profilelogin" v-model="login" maxlength="200" spellcheck="false" autocomplete="off"
        placeholder="A test user of your local app (optional)" @change="saveLogin" @keydown.enter.prevent="saveLogin" />
    </Field>
    <Field>
      <FieldLabel for="profilepassword">Test password</FieldLabel>
      <Input id="profilepassword" v-model="password" type="password" maxlength="500" autocomplete="new-password" :disabled="!profile.login"
        :placeholder="profile.hasPassword ? 'Kept (type to change it)' : 'Test password'" @change="savePassword" @keydown.enter.prevent="savePassword" />
      <FieldDescription>Kulisa types them itself, on local addresses only; the agent never sees the password.</FieldDescription>
    </Field>
    <Field>
      <FieldLabel for="profilesignin">Sign-ins</FieldLabel>
      <div><Button id="profilesignin" variant="outline" @click="signIn">Sign In…</Button></div>
      <FieldDescription>In a window of its own, once for every task of its projects.</FieldDescription>
    </Field>
    <Field>
      <FieldLabel>Projects</FieldLabel>
      <p class="text-muted-foreground" data-testid="projects">{{ profile.projects.join(', ') || 'none: add it on a project\'s page' }}</p>
    </Field>
    <FieldError id="profileerror" class="empty:hidden">{{ error }}</FieldError>
  </FieldGroup>
</template>
