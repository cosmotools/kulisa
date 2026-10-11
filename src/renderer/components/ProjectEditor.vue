<script setup lang="ts">
// The projects' manager (the title bar's Projects button, Project Settings… in a group's panel; at the
// first start it opens by itself on New Project): every project on the left, open or not, and + New Project; on the right one project's configuration,
// which its tasks are made from (tasks.md, Projects). New Project, as JetBrains': a name, and the location its folder
// goes in (~/Kulisa unless the human types or browses to another); it shows the folder it makes, so the human knows
// where the agent's files are, or that the folder is there and is taken as it is (the one way to make a project of
// existing code); Create Git repository (on by default: each task gets a copy of its own; not shown for a repository).
// Create makes it
// and goes on to its configuration (its agents first: it has none yet); New Task makes a task of it (a project is no
// thing to open: its tasks are; the author, 2026-10-11). A project's configuration: its folder, which stays; its code, the repositories or folders its tasks copy (the
// radio makes one the default: its agents start in its copy; × removes one; Add Folder… and Clone add one); its agents
// (the radio makes one the default: + runs it, the others are in +'s right-click menu; Add Agent… takes an agent or an
// account made before, New Account… makes one, signed in here: AccountSignIn.vue; ×); its profiles
// (New, From Another Project…, ×); these at once, not on Save. Both: its color (a dot each), its icon (its site's
// favicon when it has one, Kulisa's set, or the app's curtain in its color); its local addresses. The main process
// checks and saves (project:new, project:settings, project:repo-*, project:agent-*, project:profile-*). Reka's parts:
// the projects a Listbox, the defaults RadioGroups, the colors a ColorSwatchPicker, the icons a ToggleGroup, Create Git
// repository a Checkbox, the fields Fields.
import { computed, ref, watch } from 'vue';
import { CheckboxIndicator, CheckboxRoot, ColorSwatchPickerItem, ColorSwatchPickerItemSwatch, ColorSwatchPickerRoot, DialogClose, FieldControl,
  FieldDescription, FieldLabel, FieldRoot, ListboxContent, ListboxItem, ListboxRoot, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot,
  ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import AccountSignIn from './AccountSignIn.vue';
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
  const c = await kulisa.invoke<ProjectChoices & { location: string; sep: string; color: string }>('project:new-defaults');
  editing.value = null; sep.value = c.sep;
  title.value = 'New Project';
  name.value = ''; place.value = c.location; git.value = true; error.value = '';
  fill(c, { color: c.color, icon: 'logo' });
  await showList();
  focusName();
}
async function edit(id: string) {
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id });
  if (c.error) return fresh();
  editing.value = id; folder.value = c.folder;
  title.value = c.name;
  name.value = c.name; error.value = '';
  codeError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null;
  cloneUrl.value = ''; newName.value = '';
  fill(c, c);
  local.value = (c.local || []).join(' ');
  repos.value = c.repos; former.value = c.former || null;
  mine.value = c.projectAgents;
  showDefaults();
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  focusName();
}
async function openProjects(id?: string) {
  const { current, projects: all } = await kulisa.invoke<{ current: string | null; projects: ProjectEntry[] }>('projects:list');
  const at = id || current || all[0]?.id;
  await (at ? edit(at) : fresh());
  await show();
}
// Open, the keyboard in the name (fresh and edit put it there when it is already open).
async function show() { if (!modal.value!.isOpen()) { await modal.value!.open(); focusName(); } }
registerDialog('projects', {
  openProjects,
  async newProject() { await fresh(); await show(); },
});

async function browse() {
  const picked = await kulisa.invoke<string | null>('project:pick-location', { location: place.value.trim() });
  if (picked) place.value = picked;
}
// Create: made, then its configuration shown. Save: saved, the manager closes (stay: it opens the project next).
async function save(stay = false) {
  if (!name.value.trim()) { focusName(); return false; }
  saving.value = true;
  const look = { name: name.value, color: color.value, icon: icon.value };
  const made = !editing.value;
  const r = editing.value
    ? await kulisa.invoke<{ error?: string; id?: string } | null>('project:settings', { id: editing.value, ...look, local: local.value.split(/[\s,]+/).filter(Boolean) })
    : await kulisa.invoke<{ error?: string; id?: string } | null>('project:new', { ...look, location: place.value, git: git.value });
  saving.value = false;
  if (r?.error) { error.value = r.error; return false; }
  if (made) await edit(r!.id!);
  else if (!stay) modal.value!.close();
  return true;
}
// New Task: what was changed saved, then a task of it, in its group (a new one in this window when it has none).
async function newTask() {
  const id = editing.value;
  if (!await save(true)) return;
  modal.value!.close();
  await kulisa.invoke('project:open', { id });
}
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
  <Modal id="projects" ref="modal" title="Projects" form form-id="npform" @submit="save">
    <nav id="pjnav" aria-label="Projects">
      <ListboxRoot id="pjlist" :model-value="editing ?? undefined" aria-label="Projects" @update:model-value="(id) => id && id !== editing && edit(String(id))">
        <ListboxContent>
          <ListboxItem v-for="p in projects" :key="p.id" :value="p.id" class="item" :data-project="p.id" :style="{ '--color': p.color }">
            <span class="dot" /><span class="text"><span class="label">{{ p.name }}</span><small :title="p.folder">{{ p.folder }}</small></span>
          </ListboxItem>
        </ListboxContent>
      </ListboxRoot>
      <button id="pjnew" type="button" @click="fresh"><Icon name="i-plus" />New Project</button>
    </nav>
    <div id="pjconfig">
      <h3 id="pjtitle">{{ title }}</h3>
      <FieldRoot class="field"><FieldLabel>Name</FieldLabel><FieldControl id="npname" ref="nameField" v-model="name" data-name maxlength="64"
        placeholder="e.g. tenant-audit" spellcheck="false" @input="error = ''" /></FieldRoot>
      <FieldRoot id="nplocationrow" class="field" :hidden="!isNew"><FieldLabel>Location</FieldLabel><span class="pick"><FieldControl id="nplocation" v-model="place"
        spellcheck="false" @input="error = ''" /><button id="npbrowse" type="button" @click="browse">Browse…</button></span>
        <FieldDescription id="npwhere" class="hint">{{ where }}</FieldDescription></FieldRoot>
      <label id="npgitrow" class="check" :hidden="!isNew || there?.state === 'repo'"><CheckboxRoot id="npgit" v-model="git" class="checkbox"><CheckboxIndicator as-child><Icon name="i-done" /></CheckboxIndicator></CheckboxRoot>
        Create Git repository <small>each task gets its own copy of the code</small></label>
      <div id="npreposrow" class="field" :hidden="isNew"><span>Code</span>
        <RadioGroupRoot id="nprepos" v-model="defRepo" aria-label="Code" @update:model-value="(folder) => code('project:repo-default', { folder })">
          <div v-for="r in repos" :key="r.folder" class="removable" :data-folder="r.folder">
            <label class="item" title="The default: new tasks' agents start in its copy"><RadioGroupItem class="radio" :value="r.folder" :aria-label="`${base(r.folder)}: the default`"><RadioGroupIndicator /></RadioGroupItem><span class="text"><span class="label">{{ base(r.folder) }}</span><small :title="r.folder">{{ r.folder }}</small></span>
              <kbd>{{ r.git === 'ok' ? '' : r.git === 'none' ? 'no git' : 'no commit' }}</kbd></label>
            <button class="remove icon quiet" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project"
              @click="code('project:repo-remove', { folder: r.folder })"><Icon name="i-close" /></button>
          </div>
        </RadioGroupRoot>
      </div>
      <div id="npreposadd" class="row" :hidden="isNew">
        <button id="npaddrepo" type="button" @click="code('project:repo-add', {})">Add Folder…</button>
        <!-- Enter in the URL clones, not saves the dialog -->
        <input id="npurl" ref="url" v-model="cloneUrl" placeholder="or clone from a URL: git@github.com:me/shop.git" spellcheck="false" @keydown.enter.prevent="clone">
        <button id="npclone" type="button" :disabled="cloning" @click="clone">{{ cloning ? 'Cloning…' : 'Clone' }}</button>
      </div>
      <p id="npcodeerror" class="error">{{ codeError }}</p>
      <p id="npformer" class="hint" :hidden="isNew || !former"><span>{{ former ? `Former folder ${former}: tasks no longer work in it; move its files into a repository.` : '' }}</span>
        <button id="npshowformer" type="button" @click="kulisa.invoke('project:show-former', { id: editing })">Show</button></p>
      <div id="npagentsrow" class="field" :hidden="isNew"><span>Agents</span>
        <RadioGroupRoot id="npagents" v-model="defAgent" aria-label="Agents" @update:model-value="(agent) => agents('project:agent-default', { agent })">
          <div v-for="a in mine" :key="a.id" class="removable" :data-agent="a.id">
            <label class="item" title="The default: + makes a task with it"><RadioGroupItem class="radio" :value="a.id" :aria-label="`${a.name}: the default`"><RadioGroupIndicator /></RadioGroupItem><span class="text"><span class="label">{{ a.name }}</span></span></label>
            <button class="remove icon quiet" type="button" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project"
              @click="agents('project:agent-remove', { agent: a.id })"><Icon name="i-close" /></button>
          </div>
        </RadioGroupRoot>
      </div>
      <div id="npagentsadd" class="row" :hidden="isNew || !!signing"><ButtonMenu :items="addAgent"><button id="npagentadd" type="button" :disabled="!addable.length">Add Agent…</button></ButtonMenu>
        <ButtonMenu :items="newAccount"><button id="npaccountnew" type="button" :disabled="!choices.clis.length">New Account…</button></ButtonMenu></div>
      <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
      <p id="npagenterror" class="error">{{ agentError }}</p>
      <div id="npprofilesrow" class="field" :hidden="isNew"><span>Profiles</span>
        <div id="npprofiles">
          <div v-for="p in profiles" :key="p.id" class="removable" :data-profile="p.id">
            <div class="item"><img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span class="text"><span class="label">{{ p.name }}</span>
              <small>{{ [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') }}</small></span></div>
            <button class="remove icon quiet" type="button" title="Remove from the project (asks first)" aria-label="Remove from the project"
              @click="profileChange('project:profile-remove', { profile: p.id })"><Icon name="i-close" /></button>
          </div>
        </div>
      </div>
      <div id="npprofilesadd" class="row" :hidden="isNew">
        <input id="npnewprofile" ref="newProfile" v-model="newName" data-name maxlength="64" placeholder="A new one, e.g. ann@shop.com" spellcheck="false" aria-label="New profile"
          @keydown.enter.prevent="addProfile">
        <button id="npprofilenew" type="button" @click="addProfile">New</button>
        <ButtonMenu :items="fromAnother"><button id="npprofilefrom" type="button" :disabled="!others.length">From Another Project…</button></ButtonMenu>
      </div>
      <p id="npprofileerror" class="error">{{ profileError }}</p>
      <div class="field"><span>Color</span>
        <ColorSwatchPickerRoot id="npcolors" class="choices" aria-label="Color" :model-value="color" @update:model-value="(c) => c && (color = String(c))">
          <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
        </ColorSwatchPickerRoot>
      </div>
      <div class="field"><span>Icon</span>
        <ToggleGroupRoot id="npicons" class="choices" type="single" aria-label="Icon" :style="{ '--color': color }" :model-value="icon"
          @update:model-value="(v) => v && (icon = String(v))">
          <ToggleGroupItem v-for="v in iconValues" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="v === 'favicon'"
            :src="choices.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
        </ToggleGroupRoot>
      </div>
      <FieldRoot id="nplocalrow" class="field" :hidden="isNew"><FieldLabel>Local</FieldLabel><FieldControl id="nplocal" v-model="local" spellcheck="false"
        placeholder="More local addresses: a tunnel, dev domains (abc.ngrok.app shop.dev)" /></FieldRoot>
      <p id="nphint" class="hint">{{ isNew ? 'Created, it is not opened yet: its agents, code and profiles come next.'
        : '+ makes a task from this configuration: copies of its code, its default agent, its profiles closed until needed.' }}</p>
      <p id="nperror" class="error">{{ error }}</p>
    </div>
    <template #footer>
      <button id="npdelete" class="start danger" type="button" :hidden="isNew" :disabled="saving" @click="deleteIt">Delete Project…</button>
      <button id="npnewtask" class="start" type="button" :hidden="!editing" :disabled="saving" @click="newTask">New Task</button>
      <DialogClose>Cancel</DialogClose><button id="npcreate" class="primary" :disabled="saving">{{ isNew ? 'Create' : 'Save' }}</button>
    </template>
  </Modal>
</template>

<style>
/* The projects on the left, each scrolling on its own, one project's configuration on the right; its colors and icons
   to choose from (a color a dot, an icon in the project's color) */
#projects { width: min(860px, 92vw); height: 85vh;
  .body { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: var(--pad); overflow: hidden; padding-block-end: 0; }
  #pjnav { display: flex; flex-direction: column; gap: var(--inset); min-height: 0; padding-inline-end: var(--pad);
    border-inline-end: 1px solid var(--island-hi); }
  #pjlist { flex: 1; min-height: 0; overflow: auto; }
  #pjnew { display: flex; align-items: center; justify-content: center; gap: 6px; margin-block-end: 20px; }
  #pjconfig { min-height: 0; overflow: auto; padding-block-end: 20px; }
  #pjtitle { margin: 0; font-size: 1em; font-weight: 600; color: var(--text-strong); }
  :is(#npreposadd, #npcodeerror, #npagentsadd, #npsignin, #npagenterror, #npprofilesadd, #npprofileerror) { margin-inline-start: calc(var(--label) + var(--inset)); }
}
</style>
