<script setup lang="ts">
// Settings: its Projects tab (the projects' manager, a project's page) and its Agents tab. docs/tasks.md, Projects; docs/ui.md.
import { computed, nextTick, ref, watch } from 'vue';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { CheckboxIndicator, CheckboxRoot, ColorSwatchPickerItem, ColorSwatchPickerItemSwatch, ColorSwatchPickerRoot, DialogClose, FieldControl,
  FieldDescription, FieldLabel, FieldRoot, ListboxContent, ListboxItem, ListboxRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
  ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import AccountSignIn from './AccountSignIn.vue';
import AgentsTab from './AgentsTab.vue';
import ProjectIcon from './ProjectIcon.vue';
import { avatarSrc, iconTitle, projectIcon } from '../lib/common';
import { focusAfterMenu, focusBack, type MenuItem } from '../lib/menu';
import { covered } from '../lib/views';
import { registerDialog } from '../lib/dialogs';
import { agentList } from '../lib/agents';
import type { ProjectChoices, ProjectEntry, ProjectProfile, ProjectRepo, ProjectSettings, SignedIn } from '../types';

const modal = ref<InstanceType<typeof Modal>>();
// The tab shown; the agents' list (Settings → Agents) lives here, so an install goes on while Projects is shown, and
// Settings stays open while it runs.
const tab = ref<'projects' | 'agents'>('projects');
const agentsList = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it below (New Account…).` });
const nameField = ref<{ $el: HTMLInputElement }>(), newProfile = ref<HTMLInputElement>(), url = ref<HTMLInputElement>();
const focusName = () => nameField.value?.$el.focus(); // when it is open
const adding = ref<'' | 'clone' | 'profile'>('');
async function startAdding(what: 'clone' | 'profile') {
  adding.value = what;
  await nextTick();
  focusAfterMenu((what === 'clone' ? url : newProfile).value);
}
// A panel over the dialog: the pages become pictures, as under a menu.
const { open: lookOpen, ready: lookReady } = covered('pictures');
let lookFocused: Element | null = null;
const toggleLook = (v: boolean) => { if (v) lookFocused = document.activeElement; lookOpen.value = v; };
const projects = ref<ProjectEntry[]>([]);
const editing = ref<string | null>(null);
const name = ref(''), place = ref(''), sep = ref('/'), folder = ref('');
const git = ref(true), local = ref(''), saving = ref(false), error = ref('');
const choices = ref<ProjectChoices>({ colors: [], icons: [], agents: [], clis: [] });
const color = ref(''), icon = ref('logo');
const repos = ref<ProjectRepo[]>([]), former = ref<string | null>(null), cloneUrl = ref(''), codeError = ref(''), cloning = ref(false);
const mine = ref<{ id: string; name: string }[]>([]), agentError = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const profiles = ref<ProjectProfile[]>([]), others = ref<ProjectProfile[]>([]), newName = ref(''), profileError = ref('');
// The default repository and agent are the first ones: the main process keeps them in that order.

const isNew = computed(() => !editing.value);
const target = computed(() => (editing.value ? folder.value : `${place.value.trim().replace(/[\\/]+$/, '')}${sep.value}${name.value.trim()}`));
// What the folder at the location is (app.js, project:folder-state), asked again as the name or location is typed.
const there = ref<{ state: string; project?: string } | null>(null);
watch([name, place, editing], async () => {
  const asked = target.value;
  const r = editing.value ? null : await kulisa.invoke<{ state: string; project?: string } | null>('project:folder-state', { location: place.value, name: name.value });
  if (asked === target.value) there.value = r;
});
const where = computed(() => {
  if (editing.value || !name.value.trim() || !place.value.trim()) return '';
  const t = target.value;
  return ({ files: `${t} is there already: the project takes it as it is, its files kept`,
    repo: `${t} is a git repository: the project takes it as it is`,
    project: `${t} is the project ${there.value?.project}'s already`, file: `${t} is a file, not a folder` } as Record<string, string>)[there.value?.state ?? '']
    ?? `The project will be created in ${t}`;
});
const iconValues = computed(() => [...(choices.value.favicon ? ['favicon'] : []), ...choices.value.icons]);
const base = (f: string) => f.split(/[\\/]/).pop()!;

// The projects, the one on the right chosen.
async function showList() {
  projects.value = (await kulisa.invoke<{ projects: ProjectEntry[] }>('projects:list')).projects;
}
function fill(c: ProjectChoices, look: { color?: string; icon?: string }) {
  choices.value = c;
  color.value = look.color || c.colors[0];
  icon.value = look.icon || 'logo';
}

async function fresh() {
  await saveLook(); // the project left, what was typed in it kept
  const c = await kulisa.invoke<ProjectChoices & { location: string; sep: string; color: string }>('project:new-defaults');
  editing.value = null; sep.value = c.sep;
  name.value = ''; place.value = c.location; git.value = true; error.value = '';
  fill(c, { color: c.color, icon: 'logo' });
  await showList();
  focusName();
}
async function edit(id: string) {
  lookOpen.value = false;
  await saveLook();
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id });
  if (c.error) return fresh();
  editing.value = id; folder.value = c.folder;
  name.value = c.name; error.value = '';
  codeError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null; adding.value = '';
  cloneUrl.value = ''; newName.value = '';
  fill(c, c);
  local.value = (c.local || []).join(' ');
  saved = lookNow();
  repos.value = c.repos; former.value = c.former || null;
  mine.value = c.projectAgents;
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  document.getElementById('pjconfig')?.scrollTo(0, 0); // at its top, not where the last one was scrolled
}
async function openProjects(id?: string, on: typeof tab.value = 'projects') {
  const { current, projects: all } = await kulisa.invoke<{ current: string | null; projects: ProjectEntry[] }>('projects:list');
  const at = id || current || all[0]?.id;
  await (at ? edit(at) : fresh());
  tab.value = on;
  await show();
}
// Open; a new project's: the keyboard in its name (fresh puts it there when it is already open).
async function show() { if (!modal.value!.isOpen()) { await modal.value!.open(); if (isNew.value) focusName(); } }
registerDialog('projects', {
  openProjects,
  async newProject() { await fresh(); tab.value = 'projects'; await show(); },
  openAgents: () => openProjects(undefined, 'agents'),
});

async function browse() {
  const picked = await kulisa.invoke<string | null>('project:pick-location', { location: place.value.trim() });
  if (picked) place.value = picked;
}
// Create (a new project): made, then its page shown.
async function create() {
  if (!name.value.trim()) { focusName(); return; }
  saving.value = true;
  const r = await kulisa.invoke<{ error?: string; id?: string } | null>('project:new', { name: name.value, color: color.value, icon: icon.value,
    location: place.value, git: git.value });
  saving.value = false;
  if (r?.error) error.value = r.error; else await edit(r!.id!);
}
// A project's look and local addresses, saved as they change (its name on Enter or leaving it; the manager closed
// with a name typed: saved too). Refused: why, under them, until changed again.
let saved = '';
const lookNow = () => JSON.stringify({ name: name.value.trim(), color: color.value, icon: icon.value, local: local.value.split(/[\s,]+/).filter(Boolean) });
async function saveLook() {
  const id = editing.value, now = lookNow();
  if (!id || now === saved || !name.value.trim()) return;
  saved = now;
  const r = await kulisa.invoke<{ error?: string } | null>('project:settings', { id, ...JSON.parse(now) });
  error.value = r?.error || '';
  if (r?.error) saved = '';
  else if (editing.value === id) await showList();
}
const submit = () => (isNew.value ? create() : saveLook());
// The look's panel outlives the dialog's content (its open state is here): closed with it, or the pages stayed pictures.
function closed() { lookOpen.value = false; adding.value = ''; return saveLook(); }
// New Task: a task of it, in its group (a new one in this window when it has none).
async function newTask() {
  const id = editing.value;
  await saveLook();
  modal.value!.close();
  await kulisa.invoke('project:open', { id });
}
const more = (): MenuItem[] => [{ label: 'Delete Project…', run: deleteIt }];
// Delete Project…, here alone (the author, 2026-10-11): asked first (projects.js, askDeleteProject), closed if open;
// then the manager goes on to another project.
async function deleteIt() {
  const r = await kulisa.invoke<{ error?: string } | null>('project:delete', { id: editing.value });
  if (!r?.error) await openProjects();
}

async function code(channel: string, args: Record<string, unknown>) {
  codeError.value = '';
  const r = await kulisa.invoke<{ error?: string; repos?: ProjectRepo[]; former?: string | null } | null>(channel, { id: editing.value, ...args });
  if (r?.error) codeError.value = r.error;
  else if (r?.repos) { repos.value = r.repos; if ('former' in r) former.value = r.former || null; }
  return r;
}
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!cloneUrl.value.trim()) return url.value!.focus();
  cloning.value = true;
  if (!(await code('project:repo-clone', { url: cloneUrl.value }))?.error) { cloneUrl.value = ''; adding.value = ''; }
  cloning.value = false;
}
const codeMenu = (): MenuItem[] => [{ label: 'Add Folder…', run: () => code('project:repo-add', {}) },
  { label: 'Clone from URL…', run: () => startAdding('clone') }];

// Its agents (the agents and their accounts: main/accounts.js), the default first: + runs it.
async function agents(channel: string, args: Record<string, unknown>) {
  agentError.value = '';
  const r = await kulisa.invoke<{ error?: string; agents?: { id: string; name: string }[] } | null>(channel, { id: editing.value, ...args });
  if (r?.agents) mine.value = r.agents;
  if (r?.error) agentError.value = r.error;
}
const addable = computed(() => choices.value.agents.filter((x) => !mine.value.some((m) => m.id === x.id)));
const agentMenu = (): MenuItem[] => [
  ...addable.value.map((x) => ({ label: x.name, run: () => agents('project:agent-add', { agent: x.id }) })),
  ...(choices.value.clis.length ? [...(addable.value.length ? ['-' as const] : []), { heading: 'New Account' },
    ...choices.value.clis.map((c) => ({ label: `${c.name}…`, run: () => { agentError.value = ''; signing.value = c; } }))] : [])];
// Signed in: the project's agents with it, and it among the accounts to add to other projects.
async function signedIn(r: SignedIn) {
  signing.value = null; mine.value = r.agents ?? mine.value;
  await agentsNow();
}
// The accounts to add and the project's agents as they are now: one made or deleted (Settings → Agents) meanwhile.
async function agentsNow() {
  if (!editing.value) return;
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id: editing.value });
  if (!c.error) { choices.value = { ...choices.value, agents: c.agents }; mine.value = c.projectAgents; }
}
watch(tab, (t) => { if (t === 'projects') agentsNow(); });

async function profileChange(channel: string, args: Record<string, unknown>) {
  profileError.value = '';
  const r = await kulisa.invoke<{ error?: string; profiles?: ProjectProfile[]; others?: ProjectProfile[] } | null>(channel, { id: editing.value, ...args });
  if (r?.error) profileError.value = r.error; else if (r?.profiles) { profiles.value = r.profiles; others.value = r.others || []; }
  return r;
}
async function addProfile() {
  if (!newName.value.trim()) return newProfile.value!.focus();
  if (!(await profileChange('project:profile-new', { name: newName.value }))?.error) { newName.value = ''; adding.value = ''; }
}
const profileMenu = (): MenuItem[] => [{ label: 'New Profile…', run: () => startAdding('profile') },
  ...(others.value.length ? ['-' as const, { heading: 'From Another Project' }, ...others.value.map((p) => ({ label: p.name, sub: p.also.join(', '),
    avatar: p.avatar, run: () => profileChange('project:profile-add', { profile: p.id }) }))] : [])];
const stopAdding = () => { adding.value = ''; newName.value = ''; cloneUrl.value = ''; };
</script>

<template>
  <Modal id="projects" ref="modal" title="Settings" form form-id="npform" :stay="agentsList.state.installing" @submit="submit" @close="closed">
    <TabsRoot id="settingstabs" v-model="tab" :unmount-on-hide="false">
    <TabsList class="dialogtabs" aria-label="Settings">
      <TabsTrigger value="projects" data-tab="projects" type="button">Projects</TabsTrigger><TabsTrigger value="agents" data-tab="agents" type="button">Agents</TabsTrigger>
    </TabsList>
    <!-- Reka gives its tabs and their contents ids of its own -->
    <TabsContent class="pjtab" value="projects">
    <nav id="pjnav" aria-label="Projects">
      <button id="pjnew" type="button" @click="fresh"><Icon name="i-plus" />New Project</button>
      <ListboxRoot id="pjlist" :model-value="editing ?? undefined" aria-label="Projects" @update:model-value="(id) => id && id !== editing && edit(String(id))">
        <ListboxContent>
          <ListboxItem v-for="p in projects" :key="p.id" :value="p.id" class="item" :data-project="p.id" :style="{ '--color': p.color }">
            <ProjectIcon :p /><span class="text"><span class="label">{{ p.name }}</span></span>
          </ListboxItem>
        </ListboxContent>
      </ListboxRoot>
    </nav>
    <div id="pjconfig" :style="{ '--color': color }">
      <!-- A new project: its name, where its folder goes, git; Create -->
      <template v-if="isNew">
        <h3 id="pjtitle">New Project</h3>
        <FieldRoot class="field"><FieldLabel>Name</FieldLabel><FieldControl id="npname" ref="nameField" v-model="name" data-name maxlength="64"
          placeholder="e.g. tenant-audit" spellcheck="false" @input="error = ''" /></FieldRoot>
        <FieldRoot id="nplocationrow" class="field"><FieldLabel>Location</FieldLabel><span class="pick"><FieldControl id="nplocation" v-model="place"
          spellcheck="false" @input="error = ''" /><button id="npbrowse" type="button" @click="browse">Browse…</button></span>
          <FieldDescription id="npwhere" class="hint">{{ where }}</FieldDescription></FieldRoot>
        <label id="npgitrow" class="check" :hidden="there?.state === 'repo'"><CheckboxRoot id="npgit" v-model="git" class="checkbox"><CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot>
          Create Git repository <small>each task gets its own copy of the code</small></label>
        <p id="nperror" class="error">{{ error }}</p>
      </template>
      <!-- A project's page: what its tasks are made of, each part saved as it changes -->
      <template v-else>
        <div id="pjhead">
          <PopoverRoot :open="lookOpen" @update:open="toggleLook">
            <PopoverTrigger as-child><button id="pjlook" class="icon" type="button" title="Color and icon" aria-label="Color and icon">
              <ProjectIcon :p="{ icon, favicon: choices.favicon }" /></button></PopoverTrigger>
            <PopoverPortal>
              <PopoverContent class="menu pjlookpanel" :class="{ ready: lookReady }" align="start" :side-offset="4" :collision-padding="4"
                :style="{ '--color': color }" @close-auto-focus="focusBack($event, lookFocused)">
                <div class="heading">Color</div>
                <ColorSwatchPickerRoot id="npcolors" class="choices" aria-label="Color" :model-value="color"
                  @update:model-value="(c) => { if (c) { color = String(c); saveLook(); } }">
                  <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
                </ColorSwatchPickerRoot>
                <div class="heading">Icon</div>
                <ToggleGroupRoot id="npicons" class="choices" type="single" aria-label="Icon" :model-value="icon"
                  @update:model-value="(v) => { if (v) { icon = String(v); saveLook(); } }">
                  <ToggleGroupItem v-for="v in iconValues" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="v === 'favicon'"
                    :src="choices.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
                </ToggleGroupRoot>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
          <!-- Enter saves it, not the form -->
          <input id="npname" v-model="name" class="titlefield" data-name maxlength="64" spellcheck="false" aria-label="Name"
            title="The project's name" @input="error = ''" @change="saveLook" @keydown.enter.prevent="saveLook">
          <button id="npnewtask" class="primary" type="button" @click="newTask">New Task</button>
          <ButtonMenu :items="more" end><button id="pjmore" class="icon" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
        </div>
        <p id="nperror" class="error">{{ error }}</p>
        <section id="npreposrow" class="section">
          <div class="head"><h4>Code</h4><ButtonMenu :items="codeMenu" end><button id="npreposadd" class="icon" type="button"
            title="Add a repository or folder" aria-label="Add code"><Icon name="i-plus" /></button></ButtonMenu></div>
          <div id="nprepos" class="rows">
            <div v-for="(r, i) in repos" :key="r.folder" class="removable" :data-folder="r.folder">
              <div class="item"><span class="text"><span class="label">{{ base(r.folder) }}</span><small :title="r.folder">{{ r.folder }}</small></span>
                <kbd>{{ r.git === 'ok' ? '' : r.git === 'none' ? 'no git' : 'no commit' }}</kbd>
                <span v-if="!i && repos.length > 1" class="badge" title="New tasks' agents start in its copy">Default</span></div>
              <button v-if="i" class="action" type="button" title="New tasks' agents start in its copy" @click="code('project:repo-default', { folder: r.folder })">Make Default</button>
              <button class="remove icon quiet" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project"
                @click="code('project:repo-remove', { folder: r.folder })"><Icon name="i-close" /></button>
            </div>
          </div>
          <p v-if="!repos.length" class="empty">No code yet: its tasks work in an empty folder.</p>
          <!-- Enter in the URL clones, not submits the form; Esc puts it away -->
          <div v-if="adding === 'clone'" id="npcloneline" class="row">
            <input id="npurl" ref="url" v-model="cloneUrl" placeholder="git@github.com:me/shop.git" aria-label="Repository URL" spellcheck="false"
              @keydown.enter.prevent="clone" @keydown.esc.stop.prevent="stopAdding">
            <button type="button" @click="stopAdding">Cancel</button>
            <button id="npclone" class="primary" type="button" :disabled="cloning" @click="clone">{{ cloning ? 'Cloning…' : 'Clone' }}</button>
          </div>
          <p id="npformer" class="hint" :hidden="!former"><span>{{ former ? `Former folder ${former}: tasks no longer work in it; move its files into a repository.` : '' }}</span>
            <button id="npshowformer" type="button" @click="kulisa.invoke('project:show-former', { id: editing })">Show</button></p>
          <p id="npcodeerror" class="error">{{ codeError }}</p>
        </section>
        <section id="npagentsrow" class="section">
          <div class="head"><h4>Agents</h4><ButtonMenu :items="agentMenu" end><button id="npagentadd" class="icon" type="button" title="Add an agent"
            aria-label="Add an agent" :disabled="!!signing || (!addable.length && !choices.clis.length)"><Icon name="i-plus" /></button></ButtonMenu></div>
          <div v-if="mine.length" id="npagents" class="rows">
            <div v-for="(a, i) in mine" :key="a.id" class="removable" :data-agent="a.id">
              <div class="item"><span class="text"><span class="label">{{ a.name }}</span></span>
                <span v-if="!i && mine.length > 1" class="badge" title="+ makes a task with it">Default</span></div>
              <button v-if="i" class="action" type="button" title="+ makes a task with it; the others are in +'s right-click menu" @click="agents('project:agent-default', { agent: a.id })">Make Default</button>
              <button class="remove icon quiet" type="button" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project"
                @click="agents('project:agent-remove', { agent: a.id })"><Icon name="i-close" /></button>
            </div>
          </div>
          <p v-else-if="!signing" class="empty">No agents yet: its tasks get the terminal only.</p>
          <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
          <p id="npagenterror" class="error">{{ agentError }}</p>
        </section>
        <section id="npprofilesrow" class="section">
          <div class="head"><h4>Profiles</h4><ButtonMenu :items="profileMenu" end><button id="npprofileadd" class="icon" type="button"
            title="Add a profile: the browser profiles its tasks test as, each task with its own copy" aria-label="Add a profile"><Icon name="i-plus" /></button></ButtonMenu></div>
          <div id="npprofiles" class="rows">
            <div v-for="p in profiles" :key="p.id" class="removable" :data-profile="p.id">
              <div class="item"><img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span class="text"><span class="label">{{ p.name }}</span>
                <small>{{ [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') }}</small></span></div>
              <button class="remove icon quiet" type="button" title="Remove from the project (asks first)" aria-label="Remove from the project"
                @click="profileChange('project:profile-remove', { profile: p.id })"><Icon name="i-close" /></button>
            </div>
          </div>
          <p v-if="!profiles.length && adding !== 'profile'" class="empty">No profiles yet: the browser profiles its tasks test as, signed in once.</p>
          <!-- Enter makes it, not submits the form; Esc puts it away -->
          <div v-if="adding === 'profile'" id="npprofilesadd" class="row">
            <input id="npnewprofile" ref="newProfile" v-model="newName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com" spellcheck="false"
              aria-label="New profile" @keydown.enter.prevent="addProfile" @keydown.esc.stop.prevent="stopAdding">
            <button type="button" @click="stopAdding">Cancel</button>
            <button id="npprofilenew" class="primary" type="button" @click="addProfile">Create</button>
          </div>
          <p id="npprofileerror" class="error">{{ profileError }}</p>
        </section>
        <section id="nplocalrow" class="section">
          <div class="head"><h4>Local addresses</h4></div>
          <input id="nplocal" v-model="local" spellcheck="false" aria-label="Local addresses" placeholder="abc.ngrok.app shop.dev" @input="error = ''" @change="saveLook">
          <p class="hint">Where Kulisa may type saved test users' passwords besides localhost and your network: a tunnel, dev domains.</p>
        </section>
      </template>
    </div>
    </TabsContent>
    <TabsContent class="agtab" value="agents"><AgentsTab :list="agentsList" :active="tab === 'agents'" /></TabsContent>
    </TabsRoot>
    <template v-if="isNew && tab === 'projects'" #footer>
      <DialogClose>Cancel</DialogClose><button id="npcreate" class="primary" :disabled="saving">Create</button>
    </template>
  </Modal>
</template>

<style>
/* The projects on the left, each scrolling on its own, one project's page on the right: its top (its icon in its
   color, a button to its look; its name edited in place; New Task, ⋯), then its sections */
#projects { width: min(860px, 92vw); height: 85vh;
  .body { display: flex; flex-direction: column; overflow: hidden; padding-block: 0; }
  #settingstabs { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .dialogtabs { padding: 0; margin-block-end: 16px; }
  :is(.pjtab, .agtab):not([data-state="active"]) { display: none; }
  .pjtab { flex: 1; min-height: 0; display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: calc(var(--pad) - var(--inset)); }
  .agtab { flex: 1; min-height: 0; overflow: auto; padding-block-end: 20px; }
  #pjnav { display: flex; flex-direction: column; gap: var(--inset); min-height: 0; padding-inline-end: var(--pad);
    border-inline-end: 1px solid var(--island-hi); }
  #pjlist { flex: 1; min-height: 0; overflow: auto; .picon { flex: none; width: 18px; height: 18px; color: var(--color); }
    /* Reka keeps the last row pointed at highlighted: lit only while the list has the keyboard, else it looks chosen */
    &:not(:focus-within) .item[data-highlighted]:not(:hover, [aria-selected="true"]) { background: none; } }
  #pjnew { display: flex; align-items: center; justify-content: center; gap: 6px; }
  /* Room at its sides for the sections' rows, which reach past their text to be lit as menus' rows are */
  #pjconfig { display: flex; flex-direction: column; gap: var(--inset); min-height: 0; overflow: hidden auto; padding: 0 var(--inset) 20px;
    > * { flex: none; } }
  #npformer button { margin-inline-start: var(--gap); }
  #pjtitle { margin: 0; font-size: 1em; font-weight: 600; color: var(--text-strong); }
  #pjhead { display: flex; align-items: center; gap: var(--gap); padding-block-end: var(--inset);
    #pjlook { --icon: 24px; width: 36px; height: 36px; .picon { width: 24px; height: 24px; color: var(--color); } }
    .titlefield { flex: 1; min-width: 0; font-size: 1.3em; font-weight: 600; color: var(--text-strong); } }
  #nplocal { width: 100%; }
}
/* The look's panel: a menu's look, the colors and icons under their headings */
.pjlookpanel { min-width: 0; padding-block-end: var(--inset);
  .choices { padding-inline: var(--inset); max-width: 300px; } }
</style>
