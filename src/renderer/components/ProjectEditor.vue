<script setup lang="ts">
// The projects' manager (the title bar's Projects button, Projects… in the projects' menu, Project Settings… in a
// label's menu): every project on the left, open or not, and + New Project; on the right one project's configuration,
// which its tasks are made from (tasks.md, Projects). New Project, as JetBrains': a name, and the location its folder
// goes in (~/Kulisa unless the human types or browses to another); it shows the folder it makes, so the human knows
// where the agent's files are; Create Git repository (on by default: each task gets a copy of its own); its first
// agent. A project's configuration: its folder, which stays; its code, the repositories or folders its tasks copy (the
// radio makes one the default: its agents start in its copy; × removes one; Add Folder… and Clone add one); its agents
// (the radio makes one the default: + runs it, the others are in +'s right-click menu; Add Agent…, ×); its profiles
// (New, From Another Project…, ×); these at once, not on Save. Both: its color (a dot each), its icon (its site's
// favicon when it has one, Kulisa's set, or the app's curtain in its color); its local addresses. The main process
// checks and saves (project:new, project:settings, project:repo-*, project:agent-*, project:profile-*).
import { computed, nextTick, ref } from 'vue';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import { avatarSrc, projectIcon } from '../lib/common';
import { openMenu } from '../lib/menu';
import { registerDialog } from '../lib/dialogs';
import type { ProjectEntry } from '../types';

interface Choices { colors: string[]; icons: string[]; agents: { id: string; name: string }[]; favicon?: string; color?: string; icon?: string }
interface Repo { folder: string; git: 'ok' | 'none' | 'nocommit' }
interface ProjProfile { id: string; name: string; avatar: string; description?: string; also: string[] }
interface Settings extends Choices {
  error?: string; name: string; folder: string; local?: string[]; repos: Repo[]; former?: string | null;
  projectAgents: { id: string; name: string }[]; profiles: ProjProfile[]; others: ProjProfile[];
}

const modal = ref<InstanceType<typeof Modal>>();
const nameInput = ref<HTMLInputElement>(), agentSelect = ref<HTMLSelectElement>(), localInput = ref<HTMLInputElement>();
const newProfile = ref<HTMLInputElement>(), url = ref<HTMLInputElement>();
const projects = ref<ProjectEntry[]>([]), openIds = ref<string[]>([]);
const editing = ref<string | null>(null);
const title = ref(''), name = ref(''), place = ref(''), sep = ref('/'), folder = ref('');
const git = ref(true), saving = ref(false), error = ref('');
const choices = ref<Choices>({ colors: [], icons: [], agents: [] });
const color = ref(''), icon = ref('logo');
const repos = ref<Repo[]>([]), former = ref<string | null>(null), codeError = ref(''), cloning = ref(false);
const mine = ref<{ id: string; name: string }[]>([]), agentError = ref('');
const profiles = ref<ProjProfile[]>([]), others = ref<ProjProfile[]>([]), profileError = ref('');
// Rows drawn again after each change (a refused one puts the radio back on the default).
const codeDrawn = ref(0), agentsDrawn = ref(0);

const isNew = computed(() => !editing.value);
const target = computed(() => (editing.value ? folder.value : `${place.value.trim().replace(/[\\/]+$/, '')}${sep.value}${name.value.trim()}`));
const where = computed(() => (!editing.value && name.value.trim() && place.value.trim() ? `The project will be created in ${target.value}` : ''));
const iconValues = computed(() => [...(choices.value.favicon ? ['favicon'] : []), ...choices.value.icons]);
const iconTitle = (v: string) => (v === 'favicon' ? "The site's favicon" : v === 'logo' ? "Kulisa's curtain" : v);
const base = (f: string) => f.split(/[\\/]/).pop()!;

// The projects, the one on the right chosen; open ones (in any window) marked.
async function showList() {
  const r = await kulisa.invoke<{ projects: ProjectEntry[]; open: { id: string }[]; elsewhere: string[] }>('projects:list');
  projects.value = r.projects;
  openIds.value = [...r.open.map((o) => o.id), ...r.elsewhere];
}
function fill(c: Choices, look: { color?: string; icon?: string }) {
  choices.value = c;
  color.value = look.color || c.colors[0];
  icon.value = look.icon || 'logo';
}

async function fresh() {
  const c = await kulisa.invoke<Choices & { location: string; sep: string; color: string }>('project:new-defaults');
  editing.value = null; sep.value = c.sep;
  title.value = 'New Project';
  name.value = ''; place.value = c.location; git.value = true; error.value = '';
  fill(c, { color: c.color, icon: 'logo' });
  await nextTick();
  agentSelect.value!.value = c.agents[0]?.id || '';
  await showList();
  nameInput.value!.focus();
}
async function edit(id: string) {
  const c = await kulisa.invoke<Settings>('project:settings-get', { id });
  if (c.error) return fresh();
  editing.value = id; folder.value = c.folder;
  title.value = c.name;
  name.value = c.name; error.value = '';
  codeError.value = ''; agentError.value = ''; profileError.value = '';
  if (url.value) url.value.value = '';
  if (newProfile.value) newProfile.value.value = '';
  fill(c, c);
  localInput.value!.value = (c.local || []).join(' ');
  repos.value = c.repos; former.value = c.former || null;
  mine.value = c.projectAgents;
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  nameInput.value!.focus();
}
async function openProjects(id?: string) {
  const { current, projects: all } = await kulisa.invoke<{ current: string | null; projects: ProjectEntry[] }>('projects:list');
  const at = id || current || all[0]?.id;
  await (at ? edit(at) : fresh());
  if (!modal.value!.el!.open) modal.value!.open();
}
registerDialog('projects', {
  openProjects,
  async newProject() { await fresh(); if (!modal.value!.el!.open) modal.value!.open(); },
});

async function browse() {
  const picked = await kulisa.invoke<string | null>('project:pick-location', { location: place.value.trim() });
  if (picked) place.value = picked;
}
async function save() {
  if (!name.value.trim()) return nameInput.value!.focus();
  saving.value = true;
  const look = { name: name.value, color: color.value, icon: icon.value };
  const r = editing.value
    ? await kulisa.invoke<{ error?: string } | null>('project:settings', { id: editing.value, ...look, local: localInput.value!.value.split(/[\s,]+/).filter(Boolean) })
    : await kulisa.invoke<{ error?: string } | null>('project:new', { ...look, agent: agentSelect.value!.value || null, location: place.value, git: git.value });
  saving.value = false;
  if (r?.error) error.value = r.error; else modal.value!.close();
}

// A change to its code: the settings as they are then, or why not (its radio back on the default: drawn again).
async function code(channel: string, args: Record<string, unknown>) {
  codeError.value = '';
  const r = await kulisa.invoke<{ error?: string; repos?: Repo[]; former?: string | null } | null>(channel, { id: editing.value, ...args });
  codeDrawn.value++;
  if (r?.error) codeError.value = r.error;
  else if (r?.repos) { repos.value = r.repos; if ('former' in r) former.value = r.former || null; }
  return r;
}
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!url.value!.value.trim()) return url.value!.focus();
  cloning.value = true;
  if (!(await code('project:repo-clone', { url: url.value!.value }))?.error) url.value!.value = '';
  cloning.value = false;
}

// Its agents (the agents' accounts, Agents…), the default first: + runs it.
async function agents(channel: string, args: Record<string, unknown>) {
  agentError.value = '';
  const r = await kulisa.invoke<{ error?: string; agents?: { id: string; name: string }[] } | null>(channel, { id: editing.value, ...args });
  agentsDrawn.value++;
  if (r?.agents) mine.value = r.agents;
  if (r?.error) agentError.value = r.error;
}
const addable = computed(() => choices.value.agents.filter((x) => !mine.value.some((m) => m.id === x.id)));
const addAgent = (e: MouseEvent) => openMenu(addable.value.map((x) => ({ label: x.name, run: () => agents('project:agent-add', { agent: x.id }) })), e.currentTarget as Element);

// Its profiles (profile-store.js): who each is, and the other projects that have it too. New makes one (closed in its
// tasks: opened in a task, a copy of its master is made there); From Another Project… takes one another project has; ×
// lets go of one (the main process asks first).
async function profileChange(channel: string, args: Record<string, unknown>) {
  profileError.value = '';
  const r = await kulisa.invoke<{ error?: string; profiles?: ProjProfile[]; others?: ProjProfile[] } | null>(channel, { id: editing.value, ...args });
  if (r?.error) profileError.value = r.error; else if (r?.profiles) { profiles.value = r.profiles; others.value = r.others || []; }
  return r;
}
async function addProfile() {
  if (!newProfile.value!.value.trim()) return newProfile.value!.focus();
  if (!(await profileChange('project:profile-new', { name: newProfile.value!.value }))?.error) newProfile.value!.value = '';
}
const fromAnother = (e: MouseEvent) => openMenu(others.value.map((p) => ({ label: p.name, sub: p.also.join(', '), avatar: p.avatar,
  run: () => profileChange('project:profile-add', { profile: p.id }) })), e.currentTarget as Element);
</script>

<template>
  <Modal id="projects" ref="modal" title="Projects" form form-id="npform" @submit="save">
    <nav id="pjnav" aria-label="Projects">
      <div id="pjlist">
        <button v-for="p in projects" :key="p.id" class="item" type="button" :data-project="p.id" :style="{ '--color': p.color }"
          :aria-current="p.id === editing" @click="p.id !== editing && edit(p.id)">
          <span class="dot" /><span class="text"><span class="label">{{ p.name }}</span><small :title="p.folder">{{ p.folder }}</small></span>
          <kbd>{{ openIds.includes(p.id) ? 'open' : '' }}</kbd>
        </button>
      </div>
      <button id="pjnew" type="button" @click="fresh"><Icon name="i-plus" />New Project</button>
    </nav>
    <div id="pjconfig">
      <h3 id="pjtitle">{{ title }}</h3>
      <label class="field"><span>Name</span><input id="npname" ref="nameInput" v-model="name" data-name maxlength="64" placeholder="e.g. tenant-audit" spellcheck="false"
        @input="error = ''"></label>
      <label id="nplocationrow" class="field" :hidden="!isNew"><span>Location</span><span class="pick"><input id="nplocation" v-model="place" spellcheck="false"
        @input="error = ''"><button id="npbrowse" type="button" @click="browse">Browse…</button></span></label>
      <p id="npwhere" class="hint">{{ where }}</p>
      <label id="npgitrow" class="check" :hidden="!isNew"><input id="npgit" v-model="git" type="checkbox">Create Git repository <small>each task gets its own copy of the code</small></label>
      <label id="npagentrow" class="field" :hidden="!isNew"><span>Agent</span><select id="npagent" ref="agentSelect">
        <option value="">Ask when a task starts</option><option v-for="a in choices.agents" :key="a.id" :value="a.id">{{ a.name }}</option></select></label>
      <div id="npreposrow" class="field" :hidden="isNew"><span>Code</span>
        <div id="nprepos">
          <div v-for="(r, i) in repos" :key="`${r.folder}#${codeDrawn}`" class="removable" :data-folder="r.folder">
            <label class="item" title="The default: new tasks' agents start in its copy"><input type="radio" name="npdefrepo" :checked="i === 0" :aria-label="`${base(r.folder)}: the default`"
              @change="code('project:repo-default', { folder: r.folder })"><span class="text"><span class="label">{{ base(r.folder) }}</span><small :title="r.folder">{{ r.folder }}</small></span>
              <kbd>{{ r.git === 'ok' ? '' : r.git === 'none' ? 'no git' : 'no commit' }}</kbd></label>
            <button class="remove icon quiet" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project"
              @click="code('project:repo-remove', { folder: r.folder })"><Icon name="i-close" /></button>
          </div>
        </div>
      </div>
      <div id="npreposadd" class="row" :hidden="isNew">
        <button id="npaddrepo" type="button" @click="code('project:repo-add', {})">Add Folder…</button>
        <!-- Enter in the URL clones, not saves the dialog -->
        <input id="npurl" ref="url" placeholder="or clone from a URL: git@github.com:me/shop.git" spellcheck="false" @keydown.enter.prevent="clone">
        <button id="npclone" type="button" :disabled="cloning" @click="clone">{{ cloning ? 'Cloning…' : 'Clone' }}</button>
      </div>
      <p id="npcodeerror" class="error">{{ codeError }}</p>
      <p id="npformer" class="hint" :hidden="isNew || !former"><span>{{ former ? `Former folder ${former}: tasks no longer work in it; move its files into a repository.` : '' }}</span>
        <button id="npshowformer" type="button" @click="kulisa.invoke('project:show-former', { id: editing })">Show</button></p>
      <div id="npagentsrow" class="field" :hidden="isNew"><span>Agents</span>
        <div id="npagents">
          <div v-for="(a, i) in mine" :key="`${a.id}#${agentsDrawn}`" class="removable" :data-agent="a.id">
            <label class="item" title="The default: + makes a task with it"><input type="radio" name="npdefagent" :checked="i === 0" :aria-label="`${a.name}: the default`"
              @change="agents('project:agent-default', { agent: a.id })"><span class="text"><span class="label">{{ a.name }}</span></span></label>
            <button class="remove icon quiet" type="button" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project"
              @click="agents('project:agent-remove', { agent: a.id })"><Icon name="i-close" /></button>
          </div>
        </div>
      </div>
      <div id="npagentsadd" class="row" :hidden="isNew"><button id="npagentadd" type="button" aria-haspopup="menu" :disabled="!addable.length" @click="addAgent">Add Agent…</button></div>
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
        <input id="npnewprofile" ref="newProfile" data-name maxlength="64" placeholder="A new one, e.g. ann@shop.com" spellcheck="false" aria-label="New profile"
          @keydown.enter.prevent="addProfile">
        <button id="npprofilenew" type="button" @click="addProfile">New</button>
        <button id="npprofilefrom" type="button" aria-haspopup="menu" :disabled="!others.length" @click="fromAnother">From Another Project…</button>
      </div>
      <p id="npprofileerror" class="error">{{ profileError }}</p>
      <div class="field"><span>Color</span>
        <div id="npcolors" class="choices" role="group" aria-label="Color">
          <button v-for="c in choices.colors" :key="c" type="button" class="icon" :data-value="c" :title="c" :aria-label="c" :aria-pressed="c === color"
            :style="{ '--color': c }" @click="color = c"><span class="dot" /></button>
        </div>
      </div>
      <div class="field"><span>Icon</span>
        <div id="npicons" class="choices" role="group" aria-label="Icon" :style="{ '--color': color }">
          <button v-for="v in iconValues" :key="v" type="button" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"
            :aria-pressed="v === icon" @click="icon = v"><img v-if="v === 'favicon'" :src="choices.favicon" alt=""><Icon v-else :name="projectIcon(v)" /></button>
        </div>
      </div>
      <label id="nplocalrow" class="field" :hidden="isNew"><span>Local</span><input id="nplocal" ref="localInput" spellcheck="false"
        placeholder="More local addresses: a tunnel, dev domains (abc.ngrok.app shop.dev)"></label>
      <p id="nphint" class="hint">{{ isNew ? 'The agent its tasks run; add more in its configuration.'
        : '+ makes a task from this configuration: copies of its code, its default agent, its profiles closed until needed.' }}</p>
      <p id="nperror" class="error">{{ error }}</p>
    </div>
    <template #footer>
      <button type="button" command="close" commandfor="projects">Cancel</button><button id="npcreate" class="primary" :disabled="saving">{{ isNew ? 'Create' : 'Save' }}</button>
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
  :is(#npreposadd, #npcodeerror, #npagentsadd, #npagenterror, #npprofilesadd, #npprofileerror) { margin-inline-start: calc(80px + var(--inset)); }
  .choices { .dot { width: 14px; height: 14px; } svg { color: var(--color); } img { width: 16px; height: 16px; } } }
</style>
