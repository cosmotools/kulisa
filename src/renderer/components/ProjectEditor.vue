<script setup lang="ts">
// The projects' manager (the title bar's Projects button, Project Settings… in a group's menu; at the first start it
// opens by itself on New Project): every project on the left (its icon in its color, its name) under + New Project;
// on the right the chosen one's page, what its tasks are made of (tasks.md, Projects). New Project, as JetBrains': a
// name, and the location its folder goes in (~/Kulisa unless the human types or browses to another); it shows the
// folder it makes, so the human knows where the agent's files are, or that the folder is there and is taken as it is
// (the one way to make a project of existing code); Create Git repository (on by default: each task gets a copy of its
// own; not shown for a repository); its color and icon. Create makes it and goes on to its page (no task: a project is
// no thing to open; the author, 2026-10-11). A project's page (the author, 2026-10-11: one way of saving, every part
// says what it is): at its top its icon and name, New Task (a task of it, in its group) and ⋯ (Delete Project…); then a
// card each, saved as it changes (no Save, no Cancel): Code, the repositories or folders its tasks copy (the radio makes
// one the default: its agents start in its copy; × removes one; Add Folder… and Clone add one); Agents (the radio
// makes one the default: + runs it, the others are in +'s right-click menu; Add Agent… takes an agent or an account
// made before, New Account… makes one, signed in here: AccountSignIn.vue; ×); Profiles (New, From Another Project…,
// ×); Look, its name (on Enter or leaving it), color and icon (its site's favicon when it has one, Kulisa's set, or the
// app's curtain in its color); Local addresses. The main process checks and saves (project:new, project:settings,
// project:repo-*, project:agent-*, project:profile-*). Reka's parts: the projects a Listbox, the defaults RadioGroups,
// the colors a ColorSwatchPicker, the icons a ToggleGroup, Create Git repository a Checkbox, the fields Fields.
import { computed, ref, watch } from 'vue';
import { CheckboxIndicator, CheckboxRoot, ColorSwatchPickerItem, ColorSwatchPickerItemSwatch, ColorSwatchPickerRoot, DialogClose, FieldControl,
  FieldDescription, FieldLabel, FieldRoot, ListboxContent, ListboxItem, ListboxRoot, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot,
  ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import AccountSignIn from './AccountSignIn.vue';
import ProjectIcon from './ProjectIcon.vue';
import { avatarSrc, iconTitle, projectIcon } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import { registerDialog } from '../lib/dialogs';
import type { ProjectChoices, ProjectEntry, ProjectProfile, ProjectRepo, ProjectSettings } from '../types';

const modal = ref<InstanceType<typeof Modal>>();
const nameField = ref<{ $el: HTMLInputElement }>(), newProfile = ref<HTMLInputElement>(), url = ref<HTMLInputElement>();
const focusName = () => nameField.value?.$el.focus(); // when it is open
const projects = ref<ProjectEntry[]>([]);
const editing = ref<string | null>(null);
const title = ref(''), name = ref(''), place = ref(''), sep = ref('/'), folder = ref('');
const git = ref(true), local = ref(''), saving = ref(false), error = ref('');
const choices = ref<ProjectChoices>({ colors: [], icons: [], agents: [], clis: [] });
const color = ref(''), icon = ref('logo');
const repos = ref<ProjectRepo[]>([]), former = ref<string | null>(null), cloneUrl = ref(''), codeError = ref(''), cloning = ref(false);
const mine = ref<{ id: string; name: string }[]>([]), agentError = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const profiles = ref<ProjectProfile[]>([]), others = ref<ProjectProfile[]>([]), newName = ref(''), profileError = ref('');
// The defaults' radios: the first repository and agent, put back there when a change is refused.
const defRepo = ref(''), defAgent = ref('');
const showDefaults = () => { defRepo.value = repos.value[0]?.folder ?? ''; defAgent.value = mine.value[0]?.id ?? ''; };

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
  title.value = 'New Project';
  name.value = ''; place.value = c.location; git.value = true; error.value = '';
  fill(c, { color: c.color, icon: 'logo' });
  await showList();
  focusName();
}
async function edit(id: string) {
  await saveLook();
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id });
  if (c.error) return fresh();
  editing.value = id; folder.value = c.folder;
  title.value = c.name;
  name.value = c.name; error.value = '';
  codeError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null;
  cloneUrl.value = ''; newName.value = '';
  fill(c, c);
  local.value = (c.local || []).join(' ');
  saved = lookNow();
  repos.value = c.repos; former.value = c.former || null;
  mine.value = c.projectAgents;
  showDefaults();
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  document.getElementById('pjconfig')?.scrollTo(0, 0); // at its top, not where the last one was scrolled
}
async function openProjects(id?: string) {
  const { current, projects: all } = await kulisa.invoke<{ current: string | null; projects: ProjectEntry[] }>('projects:list');
  const at = id || current || all[0]?.id;
  await (at ? edit(at) : fresh());
  await show();
}
// Open; a new project's: the keyboard in its name (fresh puts it there when it is already open).
async function show() { if (!modal.value!.isOpen()) { await modal.value!.open(); if (isNew.value) focusName(); } }
registerDialog('projects', {
  openProjects,
  async newProject() { await fresh(); await show(); },
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
  else if (editing.value === id) { title.value = name.value.trim(); await showList(); }
}
const submit = () => (isNew.value ? create() : saveLook());
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

// A change to its code: the settings as they are then, or why not (its radio back on the default).
async function code(channel: string, args: Record<string, unknown>) {
  codeError.value = '';
  const r = await kulisa.invoke<{ error?: string; repos?: ProjectRepo[]; former?: string | null } | null>(channel, { id: editing.value, ...args });
  if (r?.error) codeError.value = r.error;
  else if (r?.repos) { repos.value = r.repos; if ('former' in r) former.value = r.former || null; }
  showDefaults();
  return r;
}
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!cloneUrl.value.trim()) return url.value!.focus();
  cloning.value = true;
  if (!(await code('project:repo-clone', { url: cloneUrl.value }))?.error) cloneUrl.value = '';
  cloning.value = false;
}

// Its agents (the agents and their accounts: main/accounts.js), the default first: + runs it.
async function agents(channel: string, args: Record<string, unknown>) {
  agentError.value = '';
  const r = await kulisa.invoke<{ error?: string; agents?: { id: string; name: string }[] } | null>(channel, { id: editing.value, ...args });
  if (r?.agents) mine.value = r.agents;
  if (r?.error) agentError.value = r.error;
  showDefaults();
}
const addable = computed(() => choices.value.agents.filter((x) => !mine.value.some((m) => m.id === x.id)));
const addAgent = (): MenuItem[] => addable.value.map((x) => ({ label: x.name, run: () => agents('project:agent-add', { agent: x.id }) }));
const newAccount = (): MenuItem[] => choices.value.clis.map((c) => ({ label: c.name, run: () => { agentError.value = ''; signing.value = c; } }));
// Signed in: the project's agents with it, and it among the accounts to add to other projects.
async function signedIn(list: { id: string; name: string }[]) {
  signing.value = null; mine.value = list; showDefaults();
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id: editing.value });
  if (!c.error) choices.value = { ...choices.value, agents: c.agents };
}

// Its profiles (profile-store.js): who each is, and the other projects that have it too. New makes one (closed in its
// tasks: opened in a task, a copy of its master is made there); From Another Project… takes one another project has; ×
// lets go of one (the main process asks first).
async function profileChange(channel: string, args: Record<string, unknown>) {
  profileError.value = '';
  const r = await kulisa.invoke<{ error?: string; profiles?: ProjectProfile[]; others?: ProjectProfile[] } | null>(channel, { id: editing.value, ...args });
  if (r?.error) profileError.value = r.error; else if (r?.profiles) { profiles.value = r.profiles; others.value = r.others || []; }
  return r;
}
async function addProfile() {
  if (!newName.value.trim()) return newProfile.value!.focus();
  if (!(await profileChange('project:profile-new', { name: newName.value }))?.error) newName.value = '';
}
const fromAnother = (): MenuItem[] => others.value.map((p) => ({ label: p.name, sub: p.also.join(', '), avatar: p.avatar,
  run: () => profileChange('project:profile-add', { profile: p.id }) }));
</script>

<template>
  <Modal id="projects" ref="modal" title="Projects" form form-id="npform" @submit="submit" @close="saveLook">
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
      <!-- A new project: its name, where its folder goes, git, its look; Create -->
      <template v-if="isNew">
        <h3 id="pjtitle">{{ title }}</h3>
        <FieldRoot class="field"><FieldLabel>Name</FieldLabel><FieldControl id="npname" ref="nameField" v-model="name" data-name maxlength="64"
          placeholder="e.g. tenant-audit" spellcheck="false" @input="error = ''" /></FieldRoot>
        <FieldRoot id="nplocationrow" class="field"><FieldLabel>Location</FieldLabel><span class="pick"><FieldControl id="nplocation" v-model="place"
          spellcheck="false" @input="error = ''" /><button id="npbrowse" type="button" @click="browse">Browse…</button></span>
          <FieldDescription id="npwhere" class="hint">{{ where }}</FieldDescription></FieldRoot>
        <label id="npgitrow" class="check" :hidden="there?.state === 'repo'"><CheckboxRoot id="npgit" v-model="git" class="checkbox"><CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot>
          Create Git repository <small>each task gets its own copy of the code</small></label>
        <div class="field"><span>Color</span><ColorSwatchPickerRoot id="npcolors" class="choices" aria-label="Color" :model-value="color" @update:model-value="(c) => c && (color = String(c))">
          <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
        </ColorSwatchPickerRoot></div>
        <div class="field"><span>Icon</span><ToggleGroupRoot id="npicons" class="choices" type="single" aria-label="Icon" :model-value="icon" @update:model-value="(v) => v && (icon = String(v))">
          <ToggleGroupItem v-for="v in iconValues" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="v === 'favicon'"
            :src="choices.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
        </ToggleGroupRoot></div>
        <p id="nphint" class="hint">Created, it has no task yet: its code, agents and profiles come next.</p>
        <p id="nperror" class="error">{{ error }}</p>
      </template>
      <!-- A project's page: what its tasks are made of, each part saved as it changes -->
      <template v-else>
        <div id="pjhead">
          <ProjectIcon :p="{ icon, favicon: choices.favicon }" />
          <h3 id="pjtitle">{{ title }}</h3>
          <button id="npnewtask" class="primary" type="button" @click="newTask">New Task</button>
          <ButtonMenu :items="more" end><button id="pjmore" class="icon" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
        </div>
        <section id="npreposrow" class="card"><h4>Code</h4>
          <p class="hint">The repositories or folders each task gets a copy of. Its agent starts in the default one's.</p>
          <RadioGroupRoot id="nprepos" v-model="defRepo" aria-label="Code" @update:model-value="(folder) => code('project:repo-default', { folder })">
            <div v-for="r in repos" :key="r.folder" class="removable" :data-folder="r.folder">
              <label class="item" title="The default: new tasks' agents start in its copy"><RadioGroupItem class="radio" :value="r.folder" :aria-label="`${base(r.folder)}: the default`"><RadioGroupIndicator /></RadioGroupItem><span class="text"><span class="label">{{ base(r.folder) }}</span><small :title="r.folder">{{ r.folder }}</small></span>
                <kbd>{{ r.git === 'ok' ? '' : r.git === 'none' ? 'no git' : 'no commit' }}</kbd></label>
              <button class="remove icon quiet" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project"
                @click="code('project:repo-remove', { folder: r.folder })"><Icon name="i-close" /></button>
            </div>
          </RadioGroupRoot>
          <p id="npformer" class="hint" :hidden="!former"><span>{{ former ? `Former folder ${former}: tasks no longer work in it; move its files into a repository.` : '' }}</span>
            <button id="npshowformer" type="button" @click="kulisa.invoke('project:show-former', { id: editing })">Show</button></p>
          <div id="npreposadd" class="row">
            <button id="npaddrepo" type="button" @click="code('project:repo-add', {})">Add Folder…</button>
            <!-- Enter in the URL clones, not submits the form -->
            <input id="npurl" ref="url" v-model="cloneUrl" placeholder="or clone from a URL: git@github.com:me/shop.git" spellcheck="false" @keydown.enter.prevent="clone">
            <button id="npclone" type="button" :disabled="cloning" @click="clone">{{ cloning ? 'Cloning…' : 'Clone' }}</button>
          </div>
          <p id="npcodeerror" class="error">{{ codeError }}</p>
        </section>
        <section id="npagentsrow" class="card"><h4>Agents</h4>
          <p class="hint">Who works in its tasks. + makes a task with the default one; its right-click with another.</p>
          <RadioGroupRoot v-if="mine.length" id="npagents" v-model="defAgent" aria-label="Agents" @update:model-value="(agent) => agents('project:agent-default', { agent })">
            <div v-for="a in mine" :key="a.id" class="removable" :data-agent="a.id">
              <label class="item" title="The default: + makes a task with it"><RadioGroupItem class="radio" :value="a.id" :aria-label="`${a.name}: the default`"><RadioGroupIndicator /></RadioGroupItem><span class="text"><span class="label">{{ a.name }}</span></span></label>
              <button class="remove icon quiet" type="button" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project"
                @click="agents('project:agent-remove', { agent: a.id })"><Icon name="i-close" /></button>
            </div>
          </RadioGroupRoot>
          <p v-else class="empty">No agents yet: its tasks get the terminal only.</p>
          <div id="npagentsadd" class="row" :hidden="!!signing"><ButtonMenu :items="addAgent"><button id="npagentadd" type="button" :disabled="!addable.length">Add Agent…</button></ButtonMenu>
            <ButtonMenu :items="newAccount"><button id="npaccountnew" type="button" :disabled="!choices.clis.length">New Account…</button></ButtonMenu></div>
          <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
          <p id="npagenterror" class="error">{{ agentError }}</p>
        </section>
        <section id="npprofilesrow" class="card"><h4>Profiles</h4>
          <p class="hint">The browser profiles its tasks test as, signed in once. Each task gets its own copy, closed until needed.</p>
          <div id="npprofiles">
            <div v-for="p in profiles" :key="p.id" class="removable" :data-profile="p.id">
              <div class="item"><img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span class="text"><span class="label">{{ p.name }}</span>
                <small>{{ [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') }}</small></span></div>
              <button class="remove icon quiet" type="button" title="Remove from the project (asks first)" aria-label="Remove from the project"
                @click="profileChange('project:profile-remove', { profile: p.id })"><Icon name="i-close" /></button>
            </div>
          </div>
          <p v-if="!profiles.length" class="empty">No profiles yet.</p>
          <div id="npprofilesadd" class="row">
            <input id="npnewprofile" ref="newProfile" v-model="newName" data-name maxlength="64" placeholder="A new profile's name, e.g. ann@shop.com" spellcheck="false" aria-label="New profile"
              @keydown.enter.prevent="addProfile">
            <button id="npprofilenew" type="button" @click="addProfile">New</button>
            <ButtonMenu :items="fromAnother"><button id="npprofilefrom" type="button" :disabled="!others.length">From Another Project…</button></ButtonMenu>
          </div>
          <p id="npprofileerror" class="error">{{ profileError }}</p>
        </section>
        <section id="nplookrow" class="card"><h4>Look</h4>
          <p class="hint">How its group looks in the bar.</p>
          <FieldRoot class="field"><FieldLabel>Name</FieldLabel><FieldControl id="npname" ref="nameField" v-model="name" data-name maxlength="64"
            spellcheck="false" @input="error = ''" @change="saveLook" /></FieldRoot>
          <div class="field"><span>Color</span><ColorSwatchPickerRoot id="npcolors" class="choices" aria-label="Color" :model-value="color"
            @update:model-value="(c) => { if (c) { color = String(c); saveLook(); } }">
            <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
          </ColorSwatchPickerRoot></div>
          <div class="field"><span>Icon</span><ToggleGroupRoot id="npicons" class="choices" type="single" aria-label="Icon" :model-value="icon"
            @update:model-value="(v) => { if (v) { icon = String(v); saveLook(); } }">
            <ToggleGroupItem v-for="v in iconValues" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="v === 'favicon'"
              :src="choices.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
          </ToggleGroupRoot></div>
          <p id="nperror" class="error">{{ error }}</p>
        </section>
        <section id="nplocalrow" class="card"><h4>Local addresses</h4>
          <p class="hint">Besides localhost and your network: where Kulisa may type saved test users' passwords (a tunnel, dev domains).</p>
          <input id="nplocal" v-model="local" spellcheck="false" aria-label="Local addresses" placeholder="abc.ngrok.app shop.dev" @input="error = ''" @change="saveLook">
        </section>
      </template>
    </div>
    <template v-if="isNew" #footer>
      <DialogClose>Cancel</DialogClose><button id="npcreate" class="primary" :disabled="saving">Create</button>
    </template>
  </Modal>
</template>

<style>
/* The projects on the left, each scrolling on its own, one project's page on the right: its top (its icon in its
   color, its name, New Task, ⋯), then its cards */
#projects { width: min(860px, 92vw); height: 85vh;
  .body { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: var(--pad); overflow: hidden; padding-block-end: 0; }
  #pjnav { display: flex; flex-direction: column; gap: var(--inset); min-height: 0; padding-inline-end: var(--pad);
    border-inline-end: 1px solid var(--island-hi); }
  #pjlist { flex: 1; min-height: 0; overflow: auto; .picon { flex: none; width: 18px; height: 18px; color: var(--color); } }
  #pjnew { display: flex; align-items: center; justify-content: center; gap: 6px; }
  #pjconfig { display: flex; flex-direction: column; gap: var(--pad); min-height: 0; overflow: auto; padding-block-end: 20px; }
  #pjtitle { flex: 1; margin: 0; font-size: 1em; font-weight: 600; color: var(--text-strong); }
  #pjhead { display: flex; align-items: center; gap: var(--inset);
    .picon { flex: none; width: 28px; height: 28px; color: var(--color); } #pjtitle { font-size: 1.3em; } }
  #nplocal { width: 100%; }
}
</style>
