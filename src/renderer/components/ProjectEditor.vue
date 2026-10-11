<script setup lang="ts">
// Settings, as JetBrains' (docs/tasks.md, Projects; docs/ui.md): a tree on the left (Projects and each project, Agents),
// the chosen one's page on the right under its path. A project's page is saved as it changes (no OK, no Cancel).
// New Project is a dialog of its own (NewProject.vue).
import { computed, nextTick, ref, watch } from 'vue';
import { ColorSwatchPickerItem, ColorSwatchPickerItemSwatch, ColorSwatchPickerRoot, ListboxContent, ListboxItem, ListboxRoot,
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, ToggleGroupItem, ToggleGroupRoot, TreeItem, TreeRoot } from 'reka-ui';
import Modal from './Modal.vue';
import Icon from './Icon.vue';
import ButtonMenu from './menu/ButtonMenu.vue';
import RightClickMenu from './menu/RightClickMenu.vue';
import AccountSignIn from './AccountSignIn.vue';
import AgentsTab from './AgentsTab.vue';
import ProfilesTab from './ProfilesTab.vue';
import ProjectIcon from './ProjectIcon.vue';
import { avatarSrc, iconTitle, projectIcon } from '../lib/common';
import { focusAfterMenu, focusBack, type MenuItem } from '../lib/menu';
import { covered } from '../lib/views';
import { dialog, registerDialog } from '../lib/dialogs';
import { agentList } from '../lib/agents';
import type { ProjectChoices, ProjectEntry, ProjectProfile, ProjectRepo, ProjectSettings, SignedIn } from '../types';

const modal = ref<InstanceType<typeof Modal>>();
// The page shown; the agents' list (Settings → Agents) lives here, so an install goes on while a project is shown, and
// Settings stays open while it runs.
const tab = ref<'projects' | 'agents' | 'profiles'>('projects');
const profileAt = ref<string | null>(null); // Settings → Profiles opened at it (About this profile…)
const agentsList = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it below: + under Accounts.` });
const newProfile = ref<HTMLInputElement>(), url = ref<HTMLInputElement>();
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
const name = ref(''), local = ref(''), error = ref('');
const choices = ref<ProjectChoices>({ colors: [], icons: [], agents: [], clis: [] });
const color = ref(''), icon = ref('logo');
const repos = ref<ProjectRepo[]>([]), former = ref<string | null>(null), cloneUrl = ref(''), codeError = ref(''), cloning = ref(false);
const mine = ref<{ id: string; name: string }[]>([]), agentError = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const profiles = ref<ProjectProfile[]>([]), others = ref<ProjectProfile[]>([]), newName = ref(''), profileError = ref('');
// The selected row of each list: what −, ★, Delete and its right-click act on. The default repository and agent are
// the first ones: the main process keeps them in that order.
const repoSel = ref<string>(), agentSel = ref<string>(), profileSel = ref<string>();
// Its favicon and the file chosen, with their pictures, then Kulisa's set.
const iconValues = computed(() => { const pics = Object.keys(choices.value.pictures || {}); return [...pics.filter((v) => v === 'favicon'), ...pics.filter((v) => v !== 'favicon'), ...choices.value.icons]; });
const base = (f: string) => f.split(/[\\/]/).pop()!;

// The tree: Projects with every project under it (always open), and Agents.
type Node = { key: string; label: string; project?: ProjectEntry; children?: Node[] };
const tree = computed<Node[]>(() => [{ key: 'projects', label: 'Projects', children: projects.value.map((p) => ({ key: `p:${p.id}`, label: p.name, project: p })) },
  { key: 'agents', label: 'Agents' }, { key: 'profiles', label: 'Profiles' }]);
const expanded = ref(['projects']);
const chosenKey = computed(() => (tab.value !== 'projects' ? tab.value : editing.value ? `p:${editing.value}` : ''));
const chosenNode = computed(() => [...tree.value, ...tree.value[0].children!].find((n) => n.key === chosenKey.value));
// Choosing a row of the tree: a project's page or Agents; Projects itself only opens and closes.
function choose(e: { detail: { value?: Node }; preventDefault(): void }) {
  const n = e.detail.value;
  if (!n || n.key === 'projects') return e.preventDefault();
  if (n.key === 'agents' || n.key === 'profiles') { profileAt.value = null; tab.value = n.key; }
  else { tab.value = 'projects'; if (n.project!.id !== editing.value) edit(n.project!.id); }
}

async function showList() {
  projects.value = (await kulisa.invoke<{ projects: ProjectEntry[] }>('projects:list')).projects;
}
async function edit(id: string) {
  lookOpen.value = false;
  await saveLook();
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id });
  if (c.error) { editing.value = null; return showList(); }
  editing.value = id;
  name.value = c.name; error.value = '';
  codeError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null; adding.value = '';
  cloneUrl.value = ''; newName.value = '';
  repoSel.value = agentSel.value = profileSel.value = undefined;
  choices.value = c;
  color.value = c.color || c.colors[0];
  icon.value = c.icon || 'logo';
  local.value = (c.local || []).join(' ');
  saved = lookNow();
  repos.value = c.repos; former.value = c.former || null;
  mine.value = c.projectAgents;
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  document.getElementById('pjconfig')?.scrollTo(0, 0); // at its top, not where the last one was scrolled
}
async function openProjects(id?: string, on: typeof tab.value = 'projects', profile: string | null = null) {
  profileAt.value = profile;
  const { current, projects: all } = await kulisa.invoke<{ current: string | null; projects: ProjectEntry[] }>('projects:list');
  const at = id || current || all[0]?.id;
  if (at) await edit(at); else { editing.value = null; await showList(); }
  tab.value = on;
  if (!modal.value!.isOpen()) await modal.value!.open();
}
// New Project: its own dialog; Settings closes meanwhile, and comes back if it is cancelled.
async function newProject() {
  if (modal.value!.isOpen()) { await saveLook(); modal.value!.close(); }
  await (await dialog('newproject')).open({ fromSettings: true });
}
registerDialog('projects', {
  openProjects,
  newProject: async () => (await dialog('newproject')).open(),
  openAgents: () => openProjects(undefined, 'agents'),
  openProfiles: (id?: string) => openProjects(undefined, 'profiles', id ?? null),
});

// A project's look and local addresses, saved as they change (its name on Enter or leaving it; Settings closed with a
// name typed: saved too). Refused: why, under them, until changed again.
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
// Choose File…: a picture as its icon, saved at once (the OS's dialog; refused: why, under the name).
async function chooseIconFile() {
  const id = editing.value;
  const r = await kulisa.invoke<{ error?: string; icon?: string; pictures?: Record<string, string> }>('project:icon-file', { id });
  if (editing.value !== id) return;
  error.value = r.error || '';
  if (!r.icon) return;
  choices.value = { ...choices.value, pictures: r.pictures };
  icon.value = r.icon;
  saved = lookNow();
  await showList();
}
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
// Delete Project…, here alone (the author, 2026-10-11): asked first (projects.ts, askDeleteProject), closed if open;
// then Settings goes on to another project.
async function deleteIt() {
  const r = await kulisa.invoke<{ error?: string } | null>('project:delete', { id: editing.value });
  if (!r?.error) await openProjects();
}

// A list's row a right-click was on: selected, and its actions.
const rowAt = (e: MouseEvent, attr: string) => (e.target as Element).closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr) ?? null;

async function code(channel: string, args: Record<string, unknown>) {
  codeError.value = '';
  const r = await kulisa.invoke<{ error?: string; repos?: ProjectRepo[]; former?: string | null } | null>(channel, { id: editing.value, ...args });
  if (r?.error) codeError.value = r.error;
  else if (r?.repos) { repos.value = r.repos; if ('former' in r) former.value = r.former || null; }
  return r;
}
// The selection goes with its row, not when the row stays (refused, or a no to the question).
const removeRepo = (folder = repoSel.value) => folder && code('project:repo-remove', { folder })
  .then(() => { if (!repos.value.some((r) => r.folder === repoSel.value)) repoSel.value = undefined; });
const defaultRepo = (folder = repoSel.value) => folder && code('project:repo-default', { folder });
const repoMenu = (e: MouseEvent): MenuItem[] | null => {
  const f = rowAt(e, 'data-folder');
  if (!f) return null;
  repoSel.value = f;
  return [{ label: 'Make Default', enabled: repos.value[0]?.folder !== f, run: () => defaultRepo(f) },
    { label: 'Remove from the Project', run: () => removeRepo(f) }];
};
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!cloneUrl.value.trim()) return url.value!.focus();
  cloning.value = true;
  if (!(await code('project:repo-clone', { url: cloneUrl.value }))?.error) { cloneUrl.value = ''; adding.value = ''; }
  cloning.value = false;
}
const codeMenu = (): MenuItem[] => [{ label: 'Add Folder…', run: () => code('project:repo-add', {}) },
  { label: 'Clone from URL…', run: () => startAdding('clone') }];

// Its agents (the agents and their accounts: main/accounts.ts), the default first: + runs it.
async function agents(channel: string, args: Record<string, unknown>) {
  agentError.value = '';
  const r = await kulisa.invoke<{ error?: string; agents?: { id: string; name: string }[] } | null>(channel, { id: editing.value, ...args });
  if (r?.agents) mine.value = r.agents;
  if (r?.error) agentError.value = r.error;
}
const removeAgent = (agent = agentSel.value) => agent && agents('project:agent-remove', { agent })
  .then(() => { if (!mine.value.some((a) => a.id === agentSel.value)) agentSel.value = undefined; });
const defaultAgent = (agent = agentSel.value) => agent && agents('project:agent-default', { agent });
const agentRowMenu = (e: MouseEvent): MenuItem[] | null => {
  const a = rowAt(e, 'data-agent');
  if (!a) return null;
  agentSel.value = a;
  return [{ label: 'Make Default', enabled: mine.value[0]?.id !== a, run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
};
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
// The accounts and profiles to add, and the project's own, as they are now: one made, renamed or deleted (Settings →
// Agents, → Profiles) meanwhile.
async function agentsNow() {
  if (!editing.value) return;
  const c = await kulisa.invoke<ProjectSettings>('project:settings-get', { id: editing.value });
  if (!c.error) { choices.value = { ...choices.value, agents: c.agents }; mine.value = c.projectAgents; profiles.value = c.profiles; others.value = c.others; }
}
watch(tab, (t) => { if (t === 'projects') agentsNow(); });

async function profileChange(channel: string, args: Record<string, unknown>) {
  profileError.value = '';
  const r = await kulisa.invoke<{ error?: string; profiles?: ProjectProfile[]; others?: ProjectProfile[] } | null>(channel, { id: editing.value, ...args });
  if (r?.error) profileError.value = r.error; else if (r?.profiles) { profiles.value = r.profiles; others.value = r.others || []; }
  return r;
}
const removeProfile = (profile = profileSel.value) => profile && profileChange('project:profile-remove', { profile })
  .then(() => { if (!profiles.value.some((p) => p.id === profileSel.value)) profileSel.value = undefined; });
const profileRowMenu = (e: MouseEvent): MenuItem[] | null => {
  const p = rowAt(e, 'data-profile');
  if (!p) return null;
  profileSel.value = p;
  return [{ label: 'Remove from the Project…', run: () => removeProfile(p) }];
};
async function addProfile() {
  if (!newName.value.trim()) return newProfile.value!.focus();
  if (!(await profileChange('project:profile-new', { name: newName.value }))?.error) { newName.value = ''; adding.value = ''; }
}
const profileMenu = (): MenuItem[] => [{ label: 'New Profile…', run: () => startAdding('profile') },
  ...(others.value.length ? ['-' as const, { heading: 'Other Profiles' }, ...others.value.map((p) => ({ label: p.name, sub: p.also.join(', ') || 'in no project',
    avatar: p.avatar, run: () => profileChange('project:profile-add', { profile: p.id }) }))] : [])];
const stopAdding = () => { adding.value = ''; newName.value = ''; cloneUrl.value = ''; };
</script>

<template>
  <Modal id="projects" ref="modal" title="Settings" :stay="agentsList.state.installing" @close="closed">
    <div class="settings">
      <nav id="pjnav" aria-label="Settings">
        <div class="tools"><button id="pjnew" class="icon small" type="button" title="New Project…" aria-label="New Project" @click="newProject"><Icon name="i-plus" /></button></div>
        <TreeRoot id="pjlist" v-slot="{ flattenItems }" v-model:expanded="expanded" :items="tree" :get-key="(n: Node) => n.key" :model-value="chosenNode"
          aria-label="Settings">
          <TreeItem v-for="it in flattenItems" :key="it._id" v-bind="it.bind" class="item" :data-project="it.value.project?.id" :data-tab="it.value.project ? undefined : it.value.key"
            :style="{ '--color': it.value.project?.color }" @select="choose">
            <Icon v-if="it.hasChildren" class="twist" name="i-down" /><ProjectIcon v-if="it.value.project" :p="it.value.project" /><span class="text"><span class="label">{{ it.value.label }}</span></span>
          </TreeItem>
        </TreeRoot>
      </nav>

      <div v-show="tab === 'projects'" id="pjconfig" :style="{ '--color': color }">
        <template v-if="editing">
          <div id="pjhead" class="crumbs">
            <span>Projects</span><span aria-hidden="true">›</span><b id="pjtitle">{{ projects.find((p) => p.id === editing)?.name }}</b>
            <button id="npnewtask" type="button" @click="newTask">New Task</button>
            <ButtonMenu :items="more" end><button id="pjmore" class="icon small" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
          </div>
          <!-- Enter saves it, not a form -->
          <div class="field"><label for="npname">Name:</label><span class="pick">
            <input id="npname" v-model="name" data-name maxlength="64" spellcheck="false" @input="error = ''" @change="saveLook" @keydown.enter.prevent="saveLook">
            <PopoverRoot :open="lookOpen" @update:open="toggleLook">
              <PopoverTrigger as-child><button id="pjlook" class="select" type="button" title="Color and icon" aria-label="Color and icon">
                <ProjectIcon :p="{ icon, favicon: choices.pictures?.[icon] }" /><Icon name="i-down" /></button></PopoverTrigger>
              <PopoverPortal>
                <PopoverContent class="menu pjlookpanel" :class="{ ready: lookReady }" align="end" :side-offset="4" :collision-padding="4"
                  :style="{ '--color': color }" @close-auto-focus="focusBack($event, lookFocused)">
                  <div class="heading">Color</div>
                  <ColorSwatchPickerRoot id="npcolors" class="choices" aria-label="Color" :model-value="color"
                    @update:model-value="(c) => { if (c) { color = String(c); saveLook(); } }">
                    <ColorSwatchPickerItem v-for="c in choices.colors" :key="c" :value="c" class="icon" :data-value="c" :title="c"><ColorSwatchPickerItemSwatch class="dot" /></ColorSwatchPickerItem>
                  </ColorSwatchPickerRoot>
                  <div class="heading">Icon</div>
                  <ToggleGroupRoot id="npicons" class="choices" type="single" aria-label="Icon" :model-value="icon"
                    @update:model-value="(v) => { if (v) { icon = String(v); saveLook(); } }">
                    <ToggleGroupItem v-for="v in iconValues" :key="v" :value="v" class="icon" :data-value="v" :title="iconTitle(v)" :aria-label="iconTitle(v)"><img v-if="choices.pictures?.[v]"
                      :src="choices.pictures[v]" alt=""><Icon v-else :name="projectIcon(v)" /></ToggleGroupItem>
                  </ToggleGroupRoot>
                  <div role="separator" />
                  <button id="npiconfile" class="item" type="button" @click="chooseIconFile"><Icon class="ico" name="i-folder" /><span class="text"><span class="label">Choose File…</span></span></button>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot></span></div>
          <p id="nperror" class="error">{{ error }}</p>

          <section id="npreposrow" class="group">
            <h3 class="titled">Code</h3>
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="codeMenu"><button id="npreposadd" class="icon small" type="button" title="Add a repository or folder" aria-label="Add code"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="nprepodel" class="icon small" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project" :disabled="!repoSel" @click="removeRepo()"><Icon name="i-minus" /></button>
                <button id="nprepodefault" class="icon small" type="button" title="Make Default: new tasks' agents start in its copy" aria-label="Make Default"
                  :disabled="!repoSel || repoSel === repos[0]?.folder" @click="defaultRepo()"><Icon name="i-star" /></button>
              </div>
              <RightClickMenu :items="repoMenu">
                <ListboxRoot selection-behavior="replace" v-if="repos.length" id="nprepos" v-model="repoSel" aria-label="Code" @keydown.delete="removeRepo()">
                  <ListboxContent>
                    <ListboxItem v-for="(r, i) in repos" :key="r.folder" :value="r.folder" class="item" :data-folder="r.folder">
                      <span class="text"><span class="label">{{ base(r.folder) }}</span><small :title="r.folder">{{ r.folder }}</small></span>
                      <kbd v-if="r.git !== 'ok'" class="warn">{{ r.git === 'none' ? 'no git' : 'no commit yet' }}</kbd>
                      <kbd v-if="!i && repos.length > 1" class="default" title="New tasks' agents start in its copy">default</kbd>
                    </ListboxItem>
                  </ListboxContent>
                </ListboxRoot>
              </RightClickMenu>
              <p v-if="!repos.length" class="empty">No code yet: its tasks work in an empty folder.</p>
            </div>
            <!-- Enter in the URL clones; Esc puts it away -->
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

          <section id="npagentsrow" class="group">
            <h3 class="titled">Agents</h3>
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="agentMenu"><button id="npagentadd" class="icon small" type="button" title="Add an agent" aria-label="Add an agent"
                  :disabled="!!signing || (!addable.length && !choices.clis.length)"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="npagentdel" class="icon small" type="button" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project" :disabled="!agentSel" @click="removeAgent()"><Icon name="i-minus" /></button>
                <button id="npagentdefault" class="icon small" type="button" title="Make Default: + makes a task with it" aria-label="Make Default"
                  :disabled="!agentSel || agentSel === mine[0]?.id" @click="defaultAgent()"><Icon name="i-star" /></button>
              </div>
              <RightClickMenu :items="agentRowMenu">
                <ListboxRoot selection-behavior="replace" v-if="mine.length" id="npagents" v-model="agentSel" aria-label="Agents" @keydown.delete="removeAgent()">
                  <ListboxContent>
                    <ListboxItem v-for="(a, i) in mine" :key="a.id" :value="a.id" class="item" :data-agent="a.id">
                      <span class="text"><span class="label">{{ a.name }}</span></span>
                      <kbd v-if="!i && mine.length > 1" class="default" title="+ makes a task with it; the others are in +'s right-click menu">default</kbd>
                    </ListboxItem>
                  </ListboxContent>
                </ListboxRoot>
              </RightClickMenu>
              <p v-if="!mine.length && !signing" class="empty">No agents yet: its tasks get the terminal only.</p>
            </div>
            <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
            <p id="npagenterror" class="error">{{ agentError }}</p>
          </section>

          <section id="npprofilesrow" class="group">
            <h3 class="titled">Profiles</h3>
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="profileMenu"><button id="npprofileadd" class="icon small" type="button"
                  title="Add a profile: the browser profiles its tasks test as, each task with its own copy" aria-label="Add a profile"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="npprofiledel" class="icon small" type="button" title="Remove from the project (asks first)" aria-label="Remove from the project" :disabled="!profileSel" @click="removeProfile()"><Icon name="i-minus" /></button>
              </div>
              <RightClickMenu :items="profileRowMenu">
                <ListboxRoot selection-behavior="replace" v-if="profiles.length" id="npprofiles" v-model="profileSel" aria-label="Profiles" @keydown.delete="removeProfile()">
                  <ListboxContent>
                    <ListboxItem v-for="p in profiles" :key="p.id" :value="p.id" class="item" :data-profile="p.id">
                      <img class="avatar" alt="" :src="avatarSrc(p.avatar)"><span class="text"><span class="label">{{ p.name }}</span>
                        <small>{{ [p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join(' · ') }}</small></span>
                    </ListboxItem>
                  </ListboxContent>
                </ListboxRoot>
              </RightClickMenu>
              <p v-if="!profiles.length && adding !== 'profile'" class="empty">No profiles yet: the browser profiles its tasks test as, signed in once.</p>
            </div>
            <!-- Enter makes it; Esc puts it away -->
            <div v-if="adding === 'profile'" id="npprofilesadd" class="row">
              <input id="npnewprofile" ref="newProfile" v-model="newName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com" spellcheck="false"
                aria-label="New profile" @keydown.enter.prevent="addProfile" @keydown.esc.stop.prevent="stopAdding">
              <button type="button" @click="stopAdding">Cancel</button>
              <button id="npprofilenew" class="primary" type="button" @click="addProfile">Create</button>
            </div>
            <p id="npprofileerror" class="error">{{ profileError }}</p>
          </section>

          <section id="nplocalrow" class="group">
            <div class="field"><label for="nplocal">Local addresses:</label><input id="nplocal" v-model="local" spellcheck="false" placeholder="abc.ngrok.app shop.dev"
              @input="error = ''" @change="saveLook"></div>
            <p class="hint">Where Kulisa may type saved test users' passwords besides localhost and your network: a tunnel, dev domains.</p>
          </section>
        </template>
        <div v-else id="pjnone" class="none">
          <p class="empty">No projects yet.</p>
          <button type="button" @click="newProject">New Project…</button>
        </div>
      </div>
      <div v-show="tab === 'profiles'" id="prconfig" class="prtab">
        <div class="crumbs"><b>Profiles</b></div>
        <ProfilesTab :active="tab === 'profiles'" :at="profileAt" />
      </div>
      <div v-show="tab === 'agents'" id="agconfig" class="agtab">
        <div class="crumbs"><b>Agents</b></div>
        <AgentsTab :list="agentsList" :active="tab === 'agents'" />
      </div>
    </div>
  </Modal>
</template>

<style>
/* The tree on the left, the chosen page on the right, each scrolling on its own (JetBrains' Settings) */
#projects { width: min(1000px, 94vw); height: min(680px, 88vh);
  .body { display: flex; padding: 0; overflow: hidden; }
  .settings { flex: 1; min-width: 0; display: flex; }
  #pjnav { flex: none; width: 230px; display: flex; flex-direction: column; border-inline-end: 1px solid var(--island-hi); background: var(--window);
    .tools { display: flex; justify-content: flex-end; padding: 4px; } }
  #pjlist { flex: 1; min-height: 0; overflow: auto; padding: 0 4px 4px; outline: none;
    .item { min-height: var(--row); padding: 0 8px; gap: var(--gap); border-radius: var(--radius); padding-inline-start: calc(8px + (var(--level, 1) - 1) * 18px); }
    [aria-level="2"] { --level: 2; }
    .twist { width: 12px; height: 12px; color: var(--text-dim); } [aria-expanded="false"] .twist { rotate: -90deg; }
    .picon { flex: none; width: 16px; height: 16px; color: var(--color); }
    [aria-selected="true"] { background: var(--chosen-idle); color: var(--text-strong); }
    &:focus-within [aria-selected="true"] { background: var(--chosen); } }
  :is(#pjconfig, #agconfig, #prconfig) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--inset); overflow: hidden auto; padding: 0 var(--pad) var(--pad);
    > * { flex: none; } }
  /* Where the page is in the tree, and what acts on it at its end */
  .crumbs { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: var(--gap); min-height: calc(var(--control) + 12px);
    background: var(--island); color: var(--text-muted);
    b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--text-strong); } }
  .field { margin-top: 0; }
  .group { display: flex; flex-direction: column; gap: var(--gap); margin-top: 4px;
    > .error, > .hint { margin: 0; } > .hint:not([hidden]) { margin-inline-start: calc(var(--label) + var(--inset)); } }
  .list [role="listbox"] { max-height: calc(6 * var(--row)); overflow: auto; }
  .list .avatar { --avatar: 18px; }
  #npformer button { margin-inline-start: var(--gap); }
  #pjlook { width: auto; gap: 4px; padding: 0 6px; .picon { width: 16px; height: 16px; color: var(--color); } }
  .none { display: flex; flex-direction: column; align-items: start; gap: var(--gap); padding-top: var(--pad); .empty { margin: 0; } }
}
/* The look's panel: a menu's look, the colors and icons under their headings */
.pjlookpanel { min-width: 0; padding-block-end: var(--inset);
  .choices { padding-inline: var(--inset); max-width: 300px; } }
</style>
