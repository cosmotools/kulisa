<script setup lang="ts">
// Settings, as JetBrains' (docs/tasks.md, Projects; docs/ui.md), the whole of its window (Settings.vue): a tree on the
// left (Projects, Agents, Profiles, each with its own under it, Agents and Profiles with a + beside them; GitHub's page after
// Agents), the chosen one's page on the right under its path. Saved as it changes (no OK, no Cancel). Settings only: a project is made in a
// tasks' window (New Project…), which then opens it here.
import { computed, nextTick, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot } from 'reka-ui';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider } from '@/components/ui/sidebar';
import PageHead from './PageHead.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import AccountSignIn from '../AccountSignIn.vue';
import AgentPage from './AgentPage.vue';
import ProfilePage from './ProfilePage.vue';
import LogPage from './LogPage.vue';
import AboutPage from './AboutPage.vue';
import GitHubPage from './GitHubPage.vue';
import RepoAccount from './RepoAccount.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { avatarSrc } from '../../lib/common';
import { projectColor } from '../../lib/project-color';
import { focusAfterMenu, type MenuItem } from '../../lib/menu';
import { agentList, agentMark, type Agent } from '../../lib/agents';
import { refused } from '../../../shared/result';
import type { Result } from '../../../shared/result';
import type { Account, AccountsInfo, ProjectAgent, ProjectChoices, ProjectEntry, ProjectGitHub, ProjectProfile, ProjectFolder, SettingsProfile, SignedIn } from '../../../shared/types';
import LogoMark from '../marks/LogoMark.vue';
import GitHubMark from '../marks/GitHubMark.vue';
import { BookOpenIcon, EllipsisIcon, MinusIcon, PlusIcon, StarIcon } from '@lucide/vue';

// The page shown, of the tree's section (the log and About are pages of their own, under them); the agents' list lives here, so an
// install goes on while a project is shown, and the window stays open while it runs (close).
type Section = 'projects' | 'agents' | 'profiles' | 'github' | 'log' | 'about';
type Page = 'github' | 'log' | 'about';
const tab = ref<Section>('projects');
const agentAt = ref<string>(), profileAt = ref<string>(); // the agent, the profile shown
const agentPage = ref<InstanceType<typeof AgentPage>>();
const agentsList = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it below: + under Accounts.` });
type InputRef = { $el: HTMLInputElement }; // shadcn-vue's Input, its element the field
const newProfile = ref<InputRef>(), url = ref<InputRef>();
const adding = ref<'' | 'clone' | 'profile'>('');
async function startAdding(what: 'clone' | 'profile') {
  adding.value = what;
  await nextTick();
  focusAfterMenu((what === 'clone' ? url : newProfile).value?.$el);
}
const projects = ref<ProjectEntry[]>([]);
const editing = ref<string | null>(null);
const name = ref(''), local = ref(''), error = ref('');
const choices = ref<ProjectChoices>({ agents: [], clis: [] });
const folders = ref<ProjectFolder[]>([]), cloneUrl = ref(''), foldersError = ref(''), cloning = ref(false);
// Its repositories' GitHub accounts (src/github), asked of GitHub after the page is shown: null until they come.
const github = ref<ProjectGitHub | null>(null);
const mine = ref<ProjectAgent[]>([]), agentError = ref('');
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const profiles = ref<ProjectProfile[]>([]), others = ref<ProjectProfile[]>([]), newName = ref(''), profileError = ref('');
// The selected row of each list: what −, ★, Delete and its right-click act on. The default repository and agent are
// the first ones: the main process keeps them in that order.
const folderSel = ref<string>(), agentSel = ref<string>(), profileSel = ref<string>();
const base = (f: string) => f.split(/[\\/]/).pop()!;

// Every profile and every account, as Settings → Profiles and → Agents show them (who each is, its projects).
const allProfiles = ref<SettingsProfile[]>([]), accounts = ref<Account[]>([]), clis = ref<string[]>([]);
const showAccounts = (r: Partial<AccountsInfo>) => { if (r.accounts) accounts.value = r.accounts; if (r.clis) clis.value = r.clis; };
// Again after a change on a project's page (a profile or an account made there, a project renamed).
async function lists() {
  const [p, a] = await Promise.all([kulisa.invoke('profiles:list'), kulisa.invoke('accounts:list')]);
  allProfiles.value = p.profiles; showAccounts(a);
}

// The nav: the three sections, each a group of its own (a section is no page), GitHub's page after Agents, then the Log
// and About pages.
type Node = { key: string; label: string; section?: Section; page?: Page; project?: ProjectEntry; agent?: Agent; profile?: SettingsProfile; children?: Node[] };
const tree = computed<Node[]>(() => [
  { key: 'projects', label: 'Projects', section: 'projects', children: projects.value.map((p) => ({ key: `p:${p.id}`, label: p.name, project: p })) },
  { key: 'agents', label: 'Agents', section: 'agents', children: agentsList.state.agents.map((a) => ({ key: `a:${a.id}`, label: a.name, agent: a })) },
  { key: 'github', label: 'GitHub', page: 'github' },
  { key: 'profiles', label: 'Profiles', section: 'profiles', children: allProfiles.value.map((p) => ({ key: `f:${p.id}`, label: p.name, profile: p })) },
  { key: 'log', label: 'Log', page: 'log' }, { key: 'about', label: 'About', page: 'about' }]);
const chosenKey = computed(() => ({ projects: editing.value && `p:${editing.value}`, agents: agentAt.value && `a:${agentAt.value}`, profiles: profileAt.value && `f:${profileAt.value}`, github: 'github', log: 'log', about: 'about' })[tab.value]);
const chosenNode = computed(() => tree.value.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => n.key === chosenKey.value));
const shownAgent = computed(() => agentsList.state.agents.find((a) => a.id === agentAt.value));
const shownProfile = computed(() => allProfiles.value.find((p) => p.id === profileAt.value));
// An agent or a profile gone (deleted, not found again): the first one shown instead.
watch(() => agentsList.state.agents.map((a) => a.id).join(), () => { if (!shownAgent.value) agentAt.value = agentsList.state.agents[0]?.id; });
watch(allProfiles, () => { if (!shownProfile.value) profileAt.value = allProfiles.value[0]?.id; });
function show(n: Node) {
  if (n.project) { tab.value = 'projects'; if (n.project.id !== editing.value) void edit(n.project.id); }
  else if (n.agent) { tab.value = 'agents'; agentAt.value = n.agent.id; }
  else if (n.profile) { tab.value = 'profiles'; profileAt.value = n.profile.id; }
  else if (n.page) tab.value = n.page;
}
// The nav's groups: a section with its own, pages one after another together.
const groups = computed(() => tree.value.reduce<{ section?: Node; rows: Node[] }[]>((g, n) => {
  if (n.section) g.push({ section: n, rows: n.children ?? [] });
  else if (g.at(-1)?.section || !g.length) g.push({ rows: [n] });
  else g.at(-1)!.rows.push(n);
  return g;
}, []));
const pageIcon = (n: Node) => ({ github: GitHubMark, log: BookOpenIcon, about: LogoMark })[n.page!];
const mark = (a: Agent) => agentMark(a.agent || a.id, null);

async function showList() {
  projects.value = (await kulisa.invoke('projects:list'))!.projects;
}
async function edit(id: string) {
  await saveLook();
  const c = await kulisa.invoke('project:settings-get', { id });
  if (refused(c)) { editing.value = null; return showList(); }
  editing.value = id;
  name.value = c.name; error.value = '';
  foldersError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null; adding.value = '';
  cloneUrl.value = ''; newName.value = '';
  folderSel.value = agentSel.value = profileSel.value = undefined;
  choices.value = c;
  local.value = (c.local || []).join(' ');
  saved = lookNow();
  folders.value = c.folders;
  github.value = null; void githubNow();
  mine.value = c.projectAgents;
  profiles.value = c.profiles; others.value = c.others;
  await showList();
  document.getElementById('pjconfig')?.scrollTo(0, 0); // at its top, not where the last one was scrolled
}
// Opened at a project, on Agents or Profiles (at one: About this profile…), at the log (Report a Problem…) or About. The agents are looked for behind it: the
// user's shell, their --version (lib/agents.ts). The section first: the window is on screen while the rest loads, and
// a row clicked meanwhile stays chosen.
async function openProjects(id?: string, on: Section = 'projects', at?: string) {
  tab.value = on;
  if (on === 'profiles') profileAt.value = at ?? profileAt.value;
  // The agents as last found (or, the first time, after a moment saying so), then looked for again behind them.
  const agentsShown = new Promise<void>((shown) => { void agentsList.load(undefined, async () => shown()); });
  await lists(); // a profile gone: the first one shown instead (watch, above)
  const { project: current, projects: all } = (await kulisa.invoke('projects:list'))!;
  const pick = id || current || all[0]?.id;
  if (pick) await edit(pick); else { editing.value = null; await showList(); }
  await agentsShown;
}
// The profiles changed elsewhere (a tasks' window, the agent): the lists and the shown project's profiles read again,
// nothing typed on its page touched.
kulisa.on('settings:changed', async () => {
  await lists();
  const id = editing.value, c = id && await kulisa.invoke('project:settings-get', { id });
  if (c && !refused(c) && editing.value === id) { profiles.value = c.profiles; others.value = c.others; }
});
// Opened, or brought to the front, at a page (settings-window.ts).
// Its window is shown once all of it is there, its fonts too (settings:ready).
kulisa.on('settings:show', async ({ section, id }) => {
  await (section === 'profiles' ? openProjects(undefined, 'profiles', id ?? undefined) : section === 'log' || section === 'about' ? openProjects(undefined, section) : openProjects(id ?? undefined));
  await document.fonts.ready;
  kulisa.send('settings:ready');
});

// A project's name and local addresses, saved as they change (its name on Enter or leaving it; Settings closed with a
// name typed: saved too). Refused: why, under them, until changed again.
let saved = '';
const lookNow = () => JSON.stringify({ name: name.value.trim(), local: local.value.split(/[\s,]+/).filter(Boolean) });
async function saveLook() {
  const id = editing.value, now = lookNow();
  if (!id || now === saved || !name.value.trim()) return;
  saved = now;
  const r = await kulisa.invoke('project:settings', { id, ...JSON.parse(now) });
  error.value = r?.error || '';
  if (r?.error) saved = '';
  else if (editing.value === id) await Promise.all([showList(), lists()]);
}
// Closing (Esc, its ×: Settings.vue): what is typed saved first; not while an agent installs.
async function close() {
  if (agentsList.state.installing) return;
  await saveLook();
  kulisa.send('settings:close');
}
defineExpose({ close });
// Delete Project…, here alone (the author's choice): asked first (projects.ts, askDeleteProject), closed if open;
// then Settings goes on to the one shown, or another project.
async function deleteProject(id: string) {
  const r = await kulisa.invoke('project:delete', { id });
  if (!r?.error) await openProjects(editing.value !== id ? editing.value! : undefined, tab.value);
}

// Profiles' +: its name typed in place under the tree, Enter makes it (in no project; a project's page adds it there)
// and shows it. Delete Profile…: asked first, deleted everywhere (its copies in every task, its master).
const newProfileName = ref(''), newProfileField = ref<InputRef>(), makingProfile = ref(false), profilesError = ref('');
async function startNewProfile() {
  makingProfile.value = true; newProfileName.value = ''; profilesError.value = '';
  await nextTick();
  focusAfterMenu(newProfileField.value?.$el);
}
function stopNewProfile() { makingProfile.value = false; newProfileName.value = ''; profilesError.value = ''; }
async function createProfile() {
  if (!newProfileName.value.trim()) return newProfileField.value!.$el.focus();
  const r = await kulisa.invoke('profiles:new', { name: newProfileName.value });
  if (refused(r)) { profilesError.value = r.error; return; }
  allProfiles.value = r.profiles;
  stopNewProfile();
  tab.value = 'profiles'; profileAt.value = r.id;
}
function profileChanged(r: { profiles: SettingsProfile[]; id?: string }) {
  if (r.id) profileAt.value = r.id;
  allProfiles.value = r.profiles;
}
async function deleteProfile(id: string) {
  profilesError.value = '';
  const r = await kulisa.invoke('profiles:delete', { profile: id });
  if (refused(r)) profilesError.value = r.error ?? ''; else allProfiles.value = r.profiles;
}

// Agents' +: a new account of one of them, signed in on its page.
async function newAccount(a: Agent) {
  tab.value = 'agents'; agentAt.value = a.id;
  await nextTick();
  agentPage.value!.newAccount(a);
}
const newAccountMenu = (): MenuItem[] => [{ heading: 'New Account' }, ...agentsList.state.agents.filter((a) => clis.value.includes(a.id))
  .map((a) => ({ label: `${a.name}…`, sub: a.installed ? undefined : 'not installed', enabled: !!a.installed && !agentPage.value?.busy, run: () => newAccount(a) }))];

// What acts on a node: its page's ⋯, its right-click, and a section's +.
const actions = (n: Node): MenuItem[] => {
  if (n.section === 'projects') return [];
  if (n.section === 'agents') return newAccountMenu();
  if (n.section === 'profiles') return [{ label: 'New Profile…', run: startNewProfile }];
  if (n.project) return [{ label: 'Delete Project…', run: () => deleteProject(n.project!.id) }];
  if (n.profile) return [{ label: 'Delete Profile…', run: () => deleteProfile(n.profile!.id) }];
  if (n.page) return [];
  const a = n.agent!;
  return [{ label: 'Install', enabled: !a.installed && !!a.install && !agentsList.state.installing, run: () => agentsList.install(a.id) },
    { label: 'New Account…', enabled: clis.value.includes(a.id) && !!a.installed && !agentPage.value?.busy, run: () => newAccount(a) }];
};
const more = () => (chosenNode.value ? actions(chosenNode.value) : []);
const nodeMenu = (e: MouseEvent): MenuItem[] | null => {
  const key = rowAt(e, 'data-key'), n = tree.value.flatMap((x) => [x, ...(x.children ?? [])]).find((x) => x.key === key);
  if (!n) return null;
  if (!n.section) show(n);
  const items = actions(n);
  return items.length ? items : null;
};
// Delete on the chosen project or profile: deleted, asked first.
function deleteChosen() {
  const n = chosenNode.value;
  if (n?.project) void deleteProject(n.project.id); else if (n?.profile) void deleteProfile(n.profile.id);
}

// A list's row a right-click was on: selected, and its actions.
const rowAt = (e: MouseEvent, attr: string) => (e.target as Element).closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr) ?? null;

// A change to its folders, what the manager answers (main/ipc/projects.ts, project:folder-*).
async function changeFolders(answer: Promise<Result<{ folders?: ProjectFolder[] }>>) {
  foldersError.value = '';
  const r = await answer;
  if (refused(r)) foldersError.value = r.error;
  else if (r.folders) { folders.value = r.folders; void githubNow(); }
  return r;
}
// The repositories' GitHub accounts as they are now (accounts added or signed out in Settings → GitHub meanwhile); one
// chosen on a row binds its remote.
async function githubNow(answer?: Promise<Result<ProjectGitHub>>) {
  const id = editing.value;
  if (!id) return;
  const r = await (answer ?? kulisa.invoke('project:github-get', { id }));
  if (editing.value !== id) return;
  if (refused(r)) foldersError.value = r.error; else github.value = r;
}
const githubOf = (folder: string) => github.value?.repos.find((g) => g.folder === folder);
const bindGitHub = (remote: string, account: string) => githubNow(kulisa.invoke('project:github-set', { id: id(), remote, account }));
const id = () => editing.value!; // the project shown: every change is made on its page
// The selection goes with its row, not when the row stays (refused, or a no to the question).
const removeFolder = (folder = folderSel.value) => folder && changeFolders(kulisa.invoke('project:folder-remove', { id: id(), folder }))
  .then(() => { if (!folders.value.some((r) => r.folder === folderSel.value)) folderSel.value = undefined; });
const defaultFolder = (folder = folderSel.value) => folder && changeFolders(kulisa.invoke('project:folder-default', { id: id(), folder }));
const folderMenu = (e: MouseEvent): MenuItem[] | null => {
  const f = rowAt(e, 'data-folder');
  if (!f) return null;
  folderSel.value = f;
  return [{ label: 'Make Default', enabled: folders.value[0]?.folder !== f, run: () => defaultFolder(f) },
    { label: 'Remove from the Project', run: () => removeFolder(f) }];
};
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!cloneUrl.value.trim()) return url.value!.$el.focus();
  cloning.value = true;
  if (!(await changeFolders(kulisa.invoke('project:folder-clone', { id: id(), url: cloneUrl.value })))?.error) { cloneUrl.value = ''; adding.value = ''; }
  cloning.value = false;
}
const addMenu = (): MenuItem[] => [{ label: 'Add Folder…', run: () => changeFolders(kulisa.invoke('project:folder-add', { id: id() })) },
  { label: 'Clone from URL…', run: () => startAdding('clone') }];

// Its agents (the agents and their accounts: main/accounts.ts), the default first: + runs it.
async function agents(answer: Promise<Result<{ agents: ProjectAgent[] }>>) {
  agentError.value = '';
  const r = await answer;
  if (refused(r)) agentError.value = r.error; else mine.value = r.agents;
}
const removeAgent = (agent = agentSel.value) => agent && agents(kulisa.invoke('project:agent-remove', { id: id(), agent }))
  .then(() => { if (!mine.value.some((a) => a.id === agentSel.value)) agentSel.value = undefined; });
// agent null: none is the default (its tasks start with the island's buttons).
const defaultAgent = (agent: string | null) => agents(kulisa.invoke('project:agent-default', { id: id(), agent }));
const isDefault = (agent?: string) => !!agent && !!mine.value.find((a) => a.id === agent)?.default;
const starAgent = () => agentSel.value && defaultAgent(isDefault(agentSel.value) ? null : agentSel.value);
const agentRowMenu = (e: MouseEvent): MenuItem[] | null => {
  const a = rowAt(e, 'data-agent');
  if (!a) return null;
  agentSel.value = a;
  return [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Project', run: () => removeAgent(a) }];
};
const addable = computed(() => choices.value.agents.filter((x) => !mine.value.some((m) => m.id === x.id)));
const agentMenu = (): MenuItem[] => [
  ...addable.value.map((x) => ({ label: x.name, run: () => agents(kulisa.invoke('project:agent-add', { id: id(), agent: x.id })) })),
  ...(choices.value.clis.length ? [...(addable.value.length ? ['-' as const] : []), { heading: 'New Account' },
    ...choices.value.clis.map((c) => ({ label: `${c.name}…`, run: () => { agentError.value = ''; signing.value = c; } }))] : [])];
// Signed in: the project's agents with it, and it among the accounts to add to other projects.
async function signedIn(r: SignedIn) {
  signing.value = null; mine.value = r.agents ?? mine.value;
  await Promise.all([agentsNow(), lists()]);
}
// The accounts and profiles to add, and the project's own, as they are now: one made, renamed or deleted (Settings →
// Agents, → Profiles) meanwhile.
async function agentsNow() {
  if (!editing.value) return;
  const c = await kulisa.invoke('project:settings-get', { id: editing.value });
  if (!refused(c)) { choices.value = { ...choices.value, agents: c.agents }; mine.value = c.projectAgents; profiles.value = c.profiles; others.value = c.others; }
}
watch(tab, (t) => (t === 'projects' ? agentsNow() : lists()));

async function profileChange(answer: Promise<Result<{ profiles: ProjectProfile[]; others: ProjectProfile[] }>>) {
  profileError.value = '';
  const r = await answer;
  if (refused(r)) profileError.value = r.error; else { profiles.value = r.profiles; others.value = r.others; await lists(); }
  return r;
}
const removeProfile = (profile = profileSel.value) => profile && profileChange(kulisa.invoke('project:profile-remove', { id: id(), profile }))
  .then(() => { if (!profiles.value.some((p) => p.id === profileSel.value)) profileSel.value = undefined; });
const profileRowMenu = (e: MouseEvent): MenuItem[] | null => {
  const p = rowAt(e, 'data-profile');
  if (!p) return null;
  profileSel.value = p;
  return [{ label: 'Remove from the Project…', run: () => removeProfile(p) }];
};
async function addProfile() {
  if (!newName.value.trim()) return newProfile.value!.$el.focus();
  if (!(await profileChange(kulisa.invoke('project:profile-new', { id: id(), name: newName.value })))?.error) { newName.value = ''; adding.value = ''; }
}
const profileMenu = (): MenuItem[] => [{ label: 'New Profile…', run: () => startAdding('profile') },
  ...(others.value.length ? ['-' as const, { heading: 'Other Profiles' }, ...others.value.map((p) => ({ label: p.name, sub: p.also.join(', ') || 'in no project',
    avatar: p.avatar, run: () => profileChange(kulisa.invoke('project:profile-add', { id: id(), profile: p.id })) }))] : [])];
const stopAdding = () => { adding.value = ''; newName.value = ''; cloneUrl.value = ''; };
</script>


<template>
  <!-- The nav on the left, the chosen page on the right, each scrolling on its own -->
  <SidebarProvider id="projects" class="min-h-0 flex-1">
    <Sidebar id="pjnav" collapsible="none" class="border-r" aria-label="Settings">
      <RightClickMenu :items="nodeMenu">
        <SidebarContent id="pjlist" @keydown.delete="deleteChosen">
          <SidebarGroup v-for="g in groups" :key="g.section?.key ?? g.rows[0]!.key">
            <template v-if="g.section">
              <SidebarGroupLabel :data-key="g.section.key" :data-section="g.section.section">{{ g.section.label }}</SidebarGroupLabel>
              <!-- The same as the section's right-click, which the keyboard has -->
              <ButtonMenu v-if="g.section.section === 'agents'" :items="newAccountMenu"><SidebarGroupAction id="agentnew" as="button" type="button" title="New Account…: of an agent, signed in with its own sign-in"
                                                                                                            aria-label="New Account" :disabled="!clis.length"><PlusIcon /></SidebarGroupAction></ButtonMenu>
              <SidebarGroupAction v-else-if="g.section.section === 'profiles'" id="profilenew" as="button" type="button" title="New Profile…" aria-label="New Profile" @click="startNewProfile"><PlusIcon /></SidebarGroupAction>
            </template>
            <SidebarMenu>
              <SidebarMenuItem v-for="n in g.rows" :key="n.key">
                <SidebarMenuButton :is-active="n.key === chosenKey" :aria-current="n.key === chosenKey ? 'page' : undefined" :aria-label="n.label" :data-key="n.key" :data-page="n.page"
                                   :data-project="n.project?.id" :data-agent="n.agent?.id" :data-profile="n.profile?.id" :style="{ '--color': n.project && projectColor(n.project) }" @click="show(n)">
                  <component :is="pageIcon(n)" v-if="n.page" />
                  <ProjectIcon v-if="n.project" :p="n.project" />
                  <template v-if="n.agent"><component :is="mark(n.agent)!" v-if="mark(n.agent)" /></template>
                  <Avatar v-if="n.profile" class="size-4"><AvatarImage :src="avatarSrc(n.profile.avatar)" alt="" /></Avatar>
                  <span :title="n.label">{{ n.label }}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge v-if="n.agent && !n.agent.installed">not installed</SidebarMenuBadge>
              </SidebarMenuItem>
              <!-- Enter makes it; Esc puts it away -->
              <SidebarMenuItem v-if="g.section?.section === 'profiles' && makingProfile">
                <!-- In the groups' v-for: a function ref, one field not a list of them -->
                <Input id="profilenewname" :ref="(c) => (newProfileField = c as unknown as InputRef)" v-model="newProfileName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com" class="h-8"
                       spellcheck="false" aria-label="New profile" @input="profilesError = ''" @keydown.enter.prevent="createProfile" @keydown.esc.stop.prevent="stopNewProfile" />
                <FieldError id="profileserror" class="px-2 pt-1 empty:hidden">{{ profilesError }}</FieldError>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </RightClickMenu>
    </Sidebar>

    <div v-show="tab === 'projects'" id="pjconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <template v-if="editing">
        <PageHead id="pjtitle" section="Projects" :title="projects.find((p) => p.id === editing)?.name ?? ''">
          <ButtonMenu :items="more" end><Button id="pjmore" variant="ghost" size="icon-sm" title="More" aria-label="More"><EllipsisIcon /></Button></ButtonMenu>
        </PageHead>
        <!-- Enter saves it, not a form -->
        <Field :data-invalid="!!error || undefined">
          <FieldLabel for="pjname">Name</FieldLabel>
          <Input id="pjname" v-model="name" data-name maxlength="64" spellcheck="false" @input="error = ''" @change="saveLook" @keydown.enter.prevent="saveLook" />
          <FieldError id="pjerror" class="empty:hidden">{{ error }}</FieldError>
        </Field>

        <Card id="npfoldersrow">
          <CardHeader>
            <CardTitle>Folders</CardTitle>
            <CardDescription>Its code: a folder or a repository each, and a copy of each in every task.</CardDescription>
            <CardAction>
              <ButtonMenu :items="addMenu"><Button id="npfoldersadd" variant="ghost" size="icon-sm" title="Add a folder or a repository" aria-label="Add a folder"><PlusIcon /></Button></ButtonMenu>
              <Button id="npfolderdel" variant="ghost" size="icon-sm" title="Remove from the project (its folder stays)" aria-label="Remove from the project" :disabled="!folderSel" @click="removeFolder()"><MinusIcon /></Button>
              <Button id="npfolderdefault" variant="ghost" size="icon-sm" title="Make Default: new tasks' agents start in its copy" aria-label="Make Default"
                      :disabled="!folderSel || folderSel === folders[0]?.folder" @click="defaultFolder()"><StarIcon /></Button>
            </CardAction>
          </CardHeader>
          <!-- The menu around all of it: the list is there only with rows, and a row added later would get none -->
          <RightClickMenu :items="folderMenu">
            <CardContent class="flex flex-col gap-3">
              <ListboxRoot v-if="folders.length" id="npfolders" v-model="folderSel" selection-behavior="replace" aria-label="Folders" @keydown.delete="removeFolder()">
                <ListboxContent as-child>
                  <ItemGroup class="max-h-80 overflow-y-auto">
                    <ListboxItem v-for="(r, i) in folders" :key="r.folder" :value="r.folder" as-child>
                      <Item size="xs" class="data-[state=checked]:bg-muted" :data-folder="r.folder" :aria-label="base(r.folder)">
                        <ItemContent class="min-w-0">
                          <ItemTitle class="max-w-full truncate">{{ base(r.folder) }}</ItemTitle>
                          <ItemDescription class="truncate" :title="r.folder">{{ r.folder }}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <template v-if="githubOf(r.folder)?.remote">
                            <Badge v-if="githubOf(r.folder)!.state === 'not-github'" variant="outline" data-testid="notgithub" title="Its origin is not on github.com (or an SSH name ssh cannot tell)">not a GitHub address</Badge>
                            <Badge v-else-if="!github!.accounts.length" variant="outline" title="Add an account in Settings → GitHub">no account</Badge>
                            <RepoAccount v-else :repo="githubOf(r.folder)!" :accounts="github!.accounts" @choose="(a) => bindGitHub(githubOf(r.folder)!.remote!, a)" />
                          </template>
                          <Badge v-if="r.git !== 'ok'" variant="destructive">{{ r.git === 'none' ? 'no git' : 'no commit yet' }}</Badge>
                          <Badge v-if="!i && folders.length > 1" variant="secondary" title="New tasks' agents start in its copy">default</Badge>
                        </ItemActions>
                      </Item>
                    </ListboxItem>
                  </ItemGroup>
                </ListboxContent>
              </ListboxRoot>
              <!-- Enter in the URL clones; Esc puts it away -->
              <div v-if="adding === 'clone'" id="npcloneline" class="flex gap-2">
                <Input id="npurl" ref="url" v-model="cloneUrl" placeholder="git@github.com:me/shop.git" aria-label="Repository URL" spellcheck="false"
                       @keydown.enter.prevent="clone" @keydown.esc.stop.prevent="stopAdding" />
                <Button variant="outline" @click="stopAdding">Cancel</Button>
                <Button id="npclone" :disabled="cloning" @click="clone">{{ cloning ? 'Cloning…' : 'Clone' }}</Button>
              </div>
              <!-- Why a repository's account cannot reach it, a line each -->
              <div v-if="github?.repos.some((g) => g.why)" id="npgithub" class="flex flex-col gap-1">
                <FieldDescription v-for="g in github.repos.filter((g) => g.why)" :key="g.folder" :data-folder="g.folder">{{ base(g.folder) }}: {{ g.why }}
                  <a v-if="g.install" :href="g.install" target="_blank">Install it on {{ g.owner }}</a><template v-if="g.install"> (or ask its owner to)</template></FieldDescription>
              </div>
              <FieldError id="npfolderserror" class="empty:hidden">{{ foldersError }}</FieldError>
            </CardContent>
          </RightClickMenu>
        </Card>

        <Card id="npagentsrow">
          <CardHeader>
            <CardTitle>Agents</CardTitle>
            <CardDescription>Who works in its tasks: + makes a task with the default.</CardDescription>
            <CardAction>
              <ButtonMenu :items="agentMenu"><Button id="npagentadd" variant="ghost" size="icon-sm" title="Add an agent" aria-label="Add an agent"
                                                     :disabled="!!signing || (!addable.length && !choices.clis.length)"><PlusIcon /></Button></ButtonMenu>
              <Button id="npagentdel" variant="ghost" size="icon-sm" title="Remove from the project (its tasks keep it)" aria-label="Remove from the project" :disabled="!agentSel" @click="removeAgent()"><MinusIcon /></Button>
              <Button id="npagentdefault" variant="ghost" size="icon-sm" :disabled="!agentSel" :title="isDefault(agentSel) ? 'No Default: a new task starts with no agent, you choose one there' : 'Make Default: + makes a task with it'"
                      :aria-label="isDefault(agentSel) ? 'No Default' : 'Make Default'" @click="starAgent()"><StarIcon /></Button>
            </CardAction>
          </CardHeader>
          <!-- The menu around all of it: the list is there only with rows, and a row added later would get none -->
          <RightClickMenu :items="agentRowMenu">
            <CardContent class="flex flex-col gap-3">
              <ListboxRoot v-if="mine.length" id="npagents" v-model="agentSel" selection-behavior="replace" aria-label="Agents" @keydown.delete="removeAgent()">
                <ListboxContent as-child>
                  <ItemGroup class="max-h-80 overflow-y-auto">
                    <ListboxItem v-for="a in mine" :key="a.id" :value="a.id" as-child>
                      <Item size="xs" class="data-[state=checked]:bg-muted" :data-agent="a.id" :title="a.name" :aria-label="a.agent">
                        <ItemMedia v-if="agentMark(a.cli, null)"><component :is="agentMark(a.cli, null)!" /></ItemMedia>
                        <ItemContent class="min-w-0">
                          <ItemTitle>{{ a.agent }}</ItemTitle>
                          <ItemDescription class="truncate" data-testid="account">{{ a.email ?? '—' }}</ItemDescription>
                        </ItemContent>
                        <ItemActions><Badge v-if="a.default" variant="secondary" title="+ makes a task with it; the others are in +'s right-click menu">default</Badge></ItemActions>
                      </Item>
                    </ListboxItem>
                  </ItemGroup>
                </ListboxContent>
              </ListboxRoot>
              <Empty v-if="!mine.length && !signing" class="p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">No agents yet: its tasks get the terminal only.</EmptyTitle></Empty>
              <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
              <FieldError id="npagenterror" class="empty:hidden">{{ agentError }}</FieldError>
            </CardContent>
          </RightClickMenu>
        </Card>

        <Card id="npprofilesrow">
          <CardHeader>
            <CardTitle>Profiles</CardTitle>
            <CardDescription>The browser profiles its tasks test as, each task with its own copy.</CardDescription>
            <CardAction>
              <ButtonMenu :items="profileMenu"><Button id="npprofileadd" variant="ghost" size="icon-sm" title="Add a profile" aria-label="Add a profile"><PlusIcon /></Button></ButtonMenu>
              <Button id="npprofiledel" variant="ghost" size="icon-sm" title="Remove from the project (asks first)" aria-label="Remove from the project" :disabled="!profileSel" @click="removeProfile()"><MinusIcon /></Button>
            </CardAction>
          </CardHeader>
          <!-- The menu around all of it: the list is there only with rows, and a row added later would get none -->
          <RightClickMenu :items="profileRowMenu">
            <CardContent class="flex flex-col gap-3">
              <ListboxRoot v-if="profiles.length" id="npprofiles" v-model="profileSel" selection-behavior="replace" aria-label="Profiles" @keydown.delete="removeProfile()">
                <ListboxContent as-child>
                  <ItemGroup class="max-h-80 overflow-y-auto">
                    <ListboxItem v-for="p in profiles" :key="p.id" :value="p.id" as-child>
                      <Item size="xs" class="data-[state=checked]:bg-muted" :data-profile="p.id" :aria-label="p.name"
                            :title="[p.name, p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join('\n')">
                        <ItemMedia><Avatar class="size-6"><AvatarImage :src="avatarSrc(p.avatar)" alt="" /></Avatar></ItemMedia>
                        <ItemContent class="min-w-0">
                          <ItemTitle>{{ p.name }}</ItemTitle>
                          <ItemDescription v-if="p.description" class="truncate" data-testid="about">{{ p.description }}</ItemDescription>
                        </ItemContent>
                        <ItemActions v-if="p.also.length" data-testid="also" class="max-w-1/3 truncate text-xs text-muted-foreground">also in {{ p.also.join(', ') }}</ItemActions>
                      </Item>
                    </ListboxItem>
                  </ItemGroup>
                </ListboxContent>
              </ListboxRoot>
              <Empty v-if="!profiles.length && adding !== 'profile'" class="p-4"><EmptyTitle class="text-sm font-normal text-muted-foreground">No profiles yet: the browser profiles its tasks test as, signed in once.</EmptyTitle></Empty>
              <!-- Enter makes it; Esc puts it away -->
              <div v-if="adding === 'profile'" id="npprofilesadd" class="flex gap-2">
                <Input id="npnewprofile" ref="newProfile" v-model="newName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com" spellcheck="false"
                       aria-label="New profile" @keydown.enter.prevent="addProfile" @keydown.esc.stop.prevent="stopAdding" />
                <Button variant="outline" @click="stopAdding">Cancel</Button>
                <Button id="npprofilenew" @click="addProfile">Create</Button>
              </div>
              <FieldError id="npprofileerror" class="empty:hidden">{{ profileError }}</FieldError>
            </CardContent>
          </RightClickMenu>
        </Card>

        <Card id="nplocalrow">
          <CardHeader>
            <CardTitle><label for="nplocal">Local addresses</label></CardTitle>
            <CardDescription>Where Kulisa may type saved test users' passwords besides localhost and your network: a tunnel, dev domains.</CardDescription>
          </CardHeader>
          <CardContent><Input id="nplocal" v-model="local" spellcheck="false" placeholder="abc.ngrok.app shop.dev" @input="error = ''" @change="saveLook" /></CardContent>
        </Card>
      </template>
      <Empty v-else id="pjnone"><EmptyTitle>No projects yet.</EmptyTitle></Empty>
    </div>
    <div v-show="tab === 'profiles'" id="prconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <template v-if="shownProfile">
        <PageHead section="Profiles" :title="shownProfile.name">
          <ButtonMenu :items="more" end><Button id="profilemore" variant="ghost" size="icon-sm" title="More" aria-label="More"><EllipsisIcon /></Button></ButtonMenu>
        </PageHead>
        <ProfilePage :profile="shownProfile" @changed="profileChanged" />
      </template>
      <Empty v-else>
        <EmptyTitle>No profiles yet.</EmptyTitle>
        <EmptyContent><Button variant="outline" @click="startNewProfile">New Profile…</Button></EmptyContent>
      </Empty>
    </div>
    <div v-show="tab === 'agents'" id="agconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <PageHead v-if="shownAgent" section="Agents" :title="shownAgent.name">
        <ButtonMenu :items="more" end><Button id="agentmore" variant="ghost" size="icon-sm" title="More" aria-label="More"><EllipsisIcon /></Button></ButtonMenu>
      </PageHead>
      <AgentPage ref="agentPage" :list="agentsList" :chosen="agentAt" :accounts :clis @accounts="showAccounts" />
    </div>
    <div v-show="tab === 'github'" id="ghconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <PageHead title="GitHub" />
      <GitHubPage :shown="tab === 'github'" />
    </div>
    <!-- The log scrolls inside its box, the page not at all: its tools and buttons stay in sight -->
    <div v-show="tab === 'log'" id="lgconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-6">
      <PageHead title="Log" />
      <LogPage :shown="tab === 'log'" />
    </div>
    <div v-show="tab === 'about'" id="abconfig" class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
      <PageHead title="About" />
      <AboutPage :shown="tab === 'about'" />
    </div>
  </SidebarProvider>
</template>
