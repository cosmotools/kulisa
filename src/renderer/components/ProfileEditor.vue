<script setup lang="ts">
// The profile editor (Manage Profiles…: the profiles' chip, About this profile… in a pane's menu): the shown task's
// profiles, open and closed (ProfileRow.vue), and a new one: its picture (the one it would get lit, until the human
// picks another), name and who it is. Enter in either field adds it (Shift+Enter: a new line in who it is).
import { computed, nextTick, ref } from 'vue';
import Modal from './Modal.vue';
import Avatars from './Avatars.vue';
import ProfileRow from './ProfileRow.vue';
import { act, store } from '../lib/store';
import { registerDialog } from '../lib/dialogs';

const modal = ref<InstanceType<typeof Modal>>();
const newProfile = ref<HTMLInputElement>(), newAbout = ref<HTMLTextAreaElement>(), list = ref<HTMLElement>();
const rows = computed(() => [...store.profiles.map((p) => ({ ...p, closed: false as const })),
  ...store.closedProfiles.map((p) => ({ ...p, closed: true as const }))]);
const picked = ref<string | null>(null);
const newPicture = computed(() => picked.value || kulisa.nextAvatar(rows.value.map((p) => p.avatar)));

function manage() { modal.value!.open(); newProfile.value!.focus(); }
registerDialog('profiles', {
  manage,
  async about(key) {
    manage();
    const id = rows.value.find((p) => p.key === key)?.id;
    await nextTick();
    list.value!.querySelector<HTMLElement>(`.prow[data-profile="${CSS.escape(id || '')}"] .about`)?.focus();
  },
});
async function add() {
  const name = newProfile.value!.value.trim();
  if (!name) return newProfile.value!.focus();
  const description = newAbout.value!.value.trim(), avatar = newPicture.value;
  newProfile.value!.value = ''; newAbout.value!.value = ''; picked.value = null;
  await act('profile:new', { name, description, avatar });
  newProfile.value!.focus();
}
function aboutKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).form!.requestSubmit(); }
}
</script>

<template>
  <Modal id="profiles" ref="modal" title="Profiles">
    <p class="hint">A profile is a separate browser profile, as in Chrome: its own cookies, storage, tabs and sign-ins.
      Sign in by hand in its pane; the agent in the terminal then uses it.</p>
    <div id="plist" ref="list"><ProfileRow v-for="p in rows" :key="p.key" :p /></div>
    <form id="padd" @submit.prevent="add">
      <h3>New profile</h3>
      <div class="field"><span>Picture</span><Avatars :current="newPicture" @choose="picked = $event" /></div>
      <label class="field"><span>Name</span><input id="newProfile" ref="newProfile" data-name maxlength="64" placeholder="e.g. ann@shop.com or ann.admin" spellcheck="false"></label>
      <label class="field"><span>About</span><textarea id="newAbout" ref="newAbout" rows="2" maxlength="500" placeholder="e.g. seller in the Acme shop; can approve refunds" @keydown="aboutKey" /></label>
      <p class="hint">The agent reads this to choose the right profile for a task: who this is in your app, its role, what
        it can do. You can skip it: the agent will ask you when it needs to know, and save your answer here.</p>
      <div class="field"><span /><span><button>Add</button></span></div>
    </form>
    <template #footer>
      <button id="closeProfiles" class="primary" command="close" commandfor="profiles">Done</button>
    </template>
  </Modal>
</template>

<style>
#padd h3 { margin: calc(var(--gap) * 2) 0 0; font-size: 1em; color: var(--text-dim); }
</style>
