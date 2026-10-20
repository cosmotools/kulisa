<script setup lang="ts">
// Settings, as JetBrains' (docs/tasks.md, Projects; docs/ui.md), the whole of its window (Settings.vue): a tree on the
// left (Projects, Agents, Profiles, each with its own under it, Agents and Profiles with a + beside them; GitHub's page), the chosen
// one's page on the right under its path. Saved as it changes (no OK, no Cancel). Settings only: a project is made in a
// tasks' window (New Project…), which then opens it here.
import { computed, nextTick, ref, watch } from 'vue';
import { ListboxContent, ListboxItem, ListboxRoot, TreeItem, TreeRoot } from 'reka-ui';
import Icon from '../Icon.vue';
import ButtonMenu from '../menu/ButtonMenu.vue';
import RightClickMenu from '../menu/RightClickMenu.vue';
import AccountSignIn from '../AccountSignIn.vue';
import AgentPage from './AgentPage.vue';
import GithubPage from './GithubPage.vue';
import ProfilePage from './ProfilePage.vue';
import LogPage from './LogPage.vue';
import AboutPage from './AboutPage.vue';
import ProjectIcon from '../ProjectIcon.vue';
import { avatarSrc } from '../../lib/common';
import { projectColor } from '../../lib/project-color';
import { focusAfterMenu, modelItems, type MenuItem } from '../../lib/menu';
import { agentList, agentMark, type Agent } from '../../lib/agents';
import { refused } from '../../../shared/result';
import type { Result } from '../../../shared/result';
import type { GithubAccount } from '../../../github/ipc';
import type { RepoTeam } from '../../../shared/types';
import type { Account, AccountsInfo, ProjectRole, ProjectChoices, ProjectEntry, ProjectProfile, ProjectRepo, SettingsProfile, SignedIn } from '../../../shared/types';

// The page shown, of the tree's section (the log and About are pages of their own, under them); the agents' list lives here, so an
// install goes on while a project is shown, and the window stays open while it runs (close).
type Section = 'projects' | 'agents' | 'github' | 'profiles' | 'log' | 'about';
const tab = ref<Section>('projects');
const agentAt = ref<string>(), profileAt = ref<string>(); // the agent, the profile shown
const agentPage = ref<InstanceType<typeof AgentPage>>(), githubPage = ref<InstanceType<typeof GithubPage>>();
const agentsList = agentList({ details: true, installed: (a) => `${a.name} is installed. Make an account of it below: + under Accounts.` });
const newProfile = ref<HTMLInputElement>(), url = ref<HTMLInputElement>();
const adding = ref<'' | 'clone' | 'profile'>('');
async function startAdding(what: 'clone' | 'profile') {
  adding.value = what;
  await nextTick();
  focusAfterMenu((what === 'clone' ? url : newProfile).value);
}
const projects = ref<ProjectEntry[]>([]);
const editing = ref<string | null>(null);
const name = ref(''), local = ref(''), error = ref('');
const choices = ref<ProjectChoices>({ agents: [], clis: [] });
const ghAccounts = ref<GithubAccount[]>([]); // for its repositories' rows
const repos = ref<ProjectRepo[]>([]), former = ref<string | null>(null), cloneUrl = ref(''), codeError = ref(''), cloning = ref(false);
const mine = ref<ProjectRole[]>([]), agentError = ref('');
const repoTeam = ref<RepoTeam>({ file: null, exists: false, can: false, used: null }); // its repository's file (issue #112)
const roleName = ref(''), roleAbout = ref(''); // the selected role's words, edited under the list
const signing = ref<{ id: string; name: string } | null>(null); // New Account…: the agent it is of, while signing in
const profiles = ref<ProjectProfile[]>([]), others = ref<ProjectProfile[]>([]), newName = ref(''), profileError = ref('');
// The selected row of each list: what −, ★, Delete and its right-click act on. The default repository and role are
// the first ones: the main process keeps them in that order.
const repoSel = ref<string>(), agentSel = ref<string>(), profileSel = ref<string>();
const base = (f: string) => f.split(/[\\/]/).pop()!;

// Every profile and every account, as Settings → Profiles and → Agents show them (who each is, its projects).
const allProfiles = ref<SettingsProfile[]>([]), accounts = ref<Account[]>([]), clis = ref<string[]>([]);
const showAccounts = (r: Partial<AccountsInfo>) => { if (r.accounts) accounts.value = r.accounts; if (r.clis) clis.value = r.clis; };
// Again after a change on a project's page (a profile or an account made there, a project renamed).
async function lists() {
  const [p, a] = await Promise.all([kulisa.invoke('profiles:list'), kulisa.invoke('accounts:list')]);
  allProfiles.value = p.profiles; showAccounts(a);
}

// The tree: the three sections, each with its own under it (a section only opens and closes), then the Log and About pages.
type Node = { key: string; label: string; section?: Section; page?: 'github' | 'log' | 'about'; project?: ProjectEntry; agent?: Agent; profile?: SettingsProfile; children?: Node[] };
const tree = computed<Node[]>(() => [
  { key: 'projects', label: 'Projects', section: 'projects', children: projects.value.map((p) => ({ key: `p:${p.id}`, label: p.name, project: p })) },
  { key: 'agents', label: 'Agents', section: 'agents', children: agentsList.state.agents.map((a) => ({ key: `a:${a.id}`, label: a.name, agent: a })) },
  { key: 'github', label: 'GitHub', page: 'github' },
  { key: 'profiles', label: 'Profiles', section: 'profiles', children: allProfiles.value.map((p) => ({ key: `f:${p.id}`, label: p.name, profile: p })) },
  { key: 'log', label: 'Log', page: 'log' }, { key: 'about', label: 'About', page: 'about' }]);
const expanded = ref<string[]>(['projects', 'agents', 'profiles']);
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
function choose(e: { detail: { value?: Node }; preventDefault(): void }) {
  const n = e.detail.value;
  if (!n || n.section) return e.preventDefault();
  show(n);
}
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
  codeError.value = ''; agentError.value = ''; profileError.value = ''; signing.value = null; adding.value = '';
  cloneUrl.value = ''; newName.value = '';
  repoSel.value = agentSel.value = profileSel.value = undefined;
  choices.value = c;
  local.value = (c.local || []).join(' ');
  saved = lookNow();
  repos.value = c.repos; former.value = c.former || null;
  ghAccounts.value = (await kulisa.invoke('github:accounts')).accounts;
  mine.value = c.team; repoTeam.value = c.repoTeam;
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
  if (on !== 'log' && on !== 'about' && on !== 'github' && !expanded.value.includes(on)) expanded.value = [...expanded.value, on];
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
// Delete Project…, here alone (the author, 2026-10-11): asked first (projects.ts, askDeleteProject), closed if open;
// then Settings goes on to the one shown, or another project.
async function deleteProject(id: string) {
  const r = await kulisa.invoke('project:delete', { id });
  if (!r?.error) await openProjects(editing.value !== id ? editing.value! : undefined, tab.value);
}

// Profiles' +: its name typed in place under the tree, Enter makes it (in no project; a project's page adds it there)
// and shows it. Delete Profile…: asked first, deleted everywhere (its copies in every task, its master).
const newProfileName = ref(''), newProfileField = ref<HTMLInputElement>(), makingProfile = ref(false), profilesError = ref('');
async function startNewProfile() {
  makingProfile.value = true; newProfileName.value = ''; profilesError.value = '';
  if (!expanded.value.includes('profiles')) expanded.value = [...expanded.value, 'profiles'];
  await nextTick();
  focusAfterMenu(newProfileField.value);
}
function stopNewProfile() { makingProfile.value = false; newProfileName.value = ''; profilesError.value = ''; }
async function createProfile() {
  if (!newProfileName.value.trim()) return newProfileField.value!.focus();
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

// GitHub's +: Add Account… on its page.
async function newGithub() {
  tab.value = 'github';
  await nextTick();
  void githubPage.value!.signIn();
}

// What acts on a node: its page's ⋯, its right-click, and a section's +.
const actions = (n: Node): MenuItem[] => {
  if (n.section === 'projects') return [];
  if (n.section === 'agents') return newAccountMenu();
  if (n.section === 'profiles') return [{ label: 'New Profile…', run: startNewProfile }];
  if (n.project) return [{ label: 'Delete Project…', run: () => deleteProject(n.project!.id) }];
  if (n.profile) return [{ label: 'Delete Profile…', run: () => deleteProfile(n.profile!.id) }];
  if (n.page === 'github') return [{ label: 'Add Account…', run: newGithub }];
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

// A change to its code, what the manager answers (main/ipc/projects.ts, project:repo-*).
async function code(answer: Promise<Result<{ repos?: ProjectRepo[]; former?: string | null }>>) {
  codeError.value = '';
  const r = await answer;
  if (refused(r)) codeError.value = r.error;
  else if (r.repos) { repos.value = r.repos; if ('former' in r) former.value = r.former || null; }
  return r;
}
const id = () => editing.value!; // the project shown: every change is made on its page
// The selection goes with its row, not when the row stays (refused, or a no to the question).
const removeRepo = (folder = repoSel.value) => folder && code(kulisa.invoke('project:repo-remove', { id: id(), folder }))
  .then(() => { if (!repos.value.some((r) => r.folder === repoSel.value)) repoSel.value = undefined; });
const defaultRepo = (folder = repoSel.value) => folder && code(kulisa.invoke('project:repo-default', { id: id(), folder }));
const repoMenu = (e: MouseEvent): MenuItem[] | null => {
  const f = rowAt(e, 'data-folder');
  if (!f) return null;
  repoSel.value = f;
  const gh = repos.value.find((r) => r.folder === f)?.github;
  return [{ label: 'Make Default', enabled: repos.value[0]?.folder !== f, run: () => defaultRepo(f) },
    ...(gh ? [{ submenu: 'GitHub Account', items: githubItems(f, gh) }] : []),
    { label: 'Remove from the Project', run: () => removeRepo(f) }];
};
// The GitHub account a repository's agent work goes as (src/github/README.md): the one Kulisa suggests (one that reaches it),
// or one chosen.
const githubItems = (folder: string, gh: NonNullable<ProjectRepo['github']>): MenuItem[] => [
  { label: 'Suggested', sub: 'one that reaches it', icon: gh.chosen ? undefined : 'i-done', run: () => code(kulisa.invoke('project:repo-github', { id: id(), folder, account: null })) },
  ...(ghAccounts.value.length ? ['-' as const] : [{ heading: 'No accounts yet: Settings → GitHub' }]),
  ...ghAccounts.value.map((a) => ({ label: a.login, icon: gh.chosen && gh.account === a.id ? 'i-done' : undefined,
    run: () => code(kulisa.invoke('project:repo-github', { id: id(), folder, account: a.id })) }))];
// Cloning takes a while (the repository comes over the network): the button says so meanwhile.
async function clone() {
  if (!cloneUrl.value.trim()) return url.value!.focus();
  cloning.value = true;
  if (!(await code(kulisa.invoke('project:repo-clone', { id: id(), url: cloneUrl.value })))?.error) { cloneUrl.value = ''; adding.value = ''; }
  cloning.value = false;
}
const codeMenu = (): MenuItem[] => [{ label: 'Add Folder…', run: () => code(kulisa.invoke('project:repo-add', { id: id() })) },
  { label: 'Clone from URL…', run: () => startAdding('clone') }];

// Its team (docs/tasks.md, The team): its roles, each an account and the human's words, the default first: a new task
// starts it. An account may play several roles, so + offers every account.
async function agents(answer: Promise<Result<{ team: ProjectRole[]; repoTeam?: RepoTeam }>>) {
  agentError.value = '';
  const r = await answer;
  if (refused(r)) agentError.value = r.error; else { mine.value = r.team; if (r.repoTeam) repoTeam.value = r.repoTeam; }
}
const removeAgent = (role = agentSel.value) => role && agents(kulisa.invoke('project:role-remove', { id: id(), role }))
  .then(() => { if (!mine.value.some((a) => a.id === agentSel.value)) agentSel.value = undefined; });
// role null: none is the default (its tasks start with the island's buttons).
const defaultAgent = (role: string | null) => agents(kulisa.invoke('project:role-default', { id: id(), role }));
const isDefault = (role?: string) => !!role && !!mine.value.find((a) => a.id === role)?.default;
const starAgent = () => agentSel.value && defaultAgent(isDefault(agentSel.value) ? null : agentSel.value);
const agentRowMenu = (e: MouseEvent): MenuItem[] | null => {
  const a = rowAt(e, 'data-role');
  if (!a) return null;
  agentSel.value = a;
  return [isDefault(a) ? { label: 'No Default', run: () => defaultAgent(null) } : { label: 'Make Default', run: () => defaultAgent(a) },
    { label: 'Remove from the Team', run: () => removeAgent(a) }];
};
const addable = computed(() => choices.value.agents);
const agentMenu = (): MenuItem[] => [
  ...(addable.value.length ? [{ heading: 'New Role, Played by' }] : []),
  ...addable.value.map((x) => ({ label: x.name, run: () => agents(kulisa.invoke('project:role-add', { id: id(), account: x.id }))
    .then(() => { agentSel.value = mine.value.at(-1)?.id; void nextTick(() => document.getElementById('nprolename')?.focus()); }) })),
  ...(choices.value.clis.length ? [...(addable.value.length ? ['-' as const] : []), { heading: 'New Account' },
    ...choices.value.clis.map((c) => ({ label: `${c.name}…`, run: () => { agentError.value = ''; signing.value = c; } }))] : [])];
// The selected role's words, saved as they change (Enter or leaving the field), as the rest of the page.
const shownRole = computed(() => mine.value.find((a) => a.id === agentSel.value));
watch(shownRole, (r) => { roleName.value = r?.role ?? ''; roleAbout.value = r?.about ?? ''; }, { immediate: true });
const saveRole = () => {
  const r = shownRole.value;
  if (r && (roleName.value !== r.role || roleAbout.value !== r.about)) void agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, name: roleName.value, about: roleAbout.value }));
};
// The model it starts with: one its agent offers, or the agent's own ('').
const roleModel = computed(() => { const r = shownRole.value; return r?.models.find((m) => m.id === r.model)?.name ?? r?.model ?? 'The agent\'s own'; });
const modelMenu = (): MenuItem[] => { const r = shownRole.value!; return modelItems(r.models, r.model, (model) => agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, model: model ?? '' }))); };
// Where it is kept (issue #112): the repository's file, the same on every computer, or this computer; moved at once.
const PLACES = { project: 'Project: the repository', computer: 'This computer' } as const;
const placeMenu = (): MenuItem[] => { const r = shownRole.value!; return (['project', 'computer'] as const).map((place) => ({ label: PLACES[place],
  icon: r.place === place ? 'i-done' : undefined, enabled: place === r.place || place === 'computer' || repoTeam.value.can,
  run: () => agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, place })) })); };
// Who plays one of the file's here: an account of its agent on this computer.
const playerMenu = (): MenuItem[] => { const r = shownRole.value!; return r.players.length ? r.players.map((x) => ({ label: x.name, icon: x.id === r.account ? 'i-done' : undefined,
  run: () => agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, account: x.id })) })) : [{ heading: `No account of ${r.agent} here: + beside Agents` }]; };
// The OS it works on (#49: partners on the human's other computers): any, or one.
const OS_NAMES = { linux: 'Linux', macos: 'macOS', windows: 'Windows' } as const;
const osMenu = (): MenuItem[] => { const r = shownRole.value!; return [{ label: 'Any OS', icon: r.os ? undefined : 'i-done', run: () => agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, os: '' })) },
  ...(['linux', 'macos', 'windows'] as const).map((os) => ({ label: OS_NAMES[os], icon: r.os === os ? 'i-done' : undefined,
    run: () => agents(kulisa.invoke('project:role-update', { id: id(), role: r.id, os })) }))]; };
const useRepoTeam = (use: boolean) => agents(kulisa.invoke('project:repo-team', { id: id(), use }));
// Signed in: the project's team with it, and it among the accounts to add to other projects.
async function signedIn(r: SignedIn) {
  signing.value = null; mine.value = r.team ?? mine.value;
  await Promise.all([agentsNow(), lists()]);
}
// The accounts and profiles to add, and the project's own, as they are now: one made, renamed or deleted (Settings →
// Agents, → GitHub, → Profiles) meanwhile.
async function agentsNow() {
  if (!editing.value) return;
  const [c, gh] = await Promise.all([kulisa.invoke('project:settings-get', { id: editing.value }), kulisa.invoke('github:accounts')]);
  if (!refused(c)) { choices.value = { ...choices.value, agents: c.agents }; mine.value = c.team; repoTeam.value = c.repoTeam; profiles.value = c.profiles; others.value = c.others; repos.value = c.repos; }
  ghAccounts.value = gh.accounts;
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
  if (!newName.value.trim()) return newProfile.value!.focus();
  if (!(await profileChange(kulisa.invoke('project:profile-new', { id: id(), name: newName.value })))?.error) { newName.value = ''; adding.value = ''; }
}
const profileMenu = (): MenuItem[] => [{ label: 'New Profile…', run: () => startAdding('profile') },
  ...(others.value.length ? ['-' as const, { heading: 'Other Profiles' }, ...others.value.map((p) => ({ label: p.name, sub: p.also.join(', ') || 'in no project',
    avatar: p.avatar, run: () => profileChange(kulisa.invoke('project:profile-add', { id: id(), profile: p.id })) }))] : [])];
const stopAdding = () => { adding.value = ''; newName.value = ''; cloneUrl.value = ''; };
</script>

<template>
  <main id="projects" class="page">
    <nav id="pjnav" aria-label="Settings">
      <RightClickMenu :items="nodeMenu">
        <!-- selection-behavior replace: Reka's toggle un-chose the row shown when clicked again, its page still there -->
        <TreeRoot id="pjlist" v-slot="{ flattenItems }" v-model:expanded="expanded" :items="tree" :get-key="(n: Node) => n.key" :model-value="chosenNode"
          selection-behavior="replace"
          aria-label="Settings" @keydown.delete="deleteChosen">
          <TreeItem v-for="it in flattenItems" :key="it._id" v-bind="it.bind" class="item" :data-key="it.value.key" :data-section="it.value.section" :data-page="it.value.page"
            :data-project="it.value.project?.id" :data-agent="it.value.agent?.id" :data-profile="it.value.profile?.id"
            :style="{ '--color': it.value.project && projectColor(it.value.project) }" @select="choose">
            <Icon v-if="it.value.section" class="twist" name="i-down" /><Icon v-else-if="it.value.page" class="twist" :name="({ github: 'i-github', log: 'i-docs', about: 'i-logo' } as const)[it.value.page]" /><ProjectIcon v-if="it.value.project" :p="it.value.project" />
            <template v-if="it.value.agent"><Icon v-if="mark(it.value.agent)" class="logo" :name="mark(it.value.agent)!" /></template>
            <img v-if="it.value.profile" class="avatar" alt="" :src="avatarSrc(it.value.profile.avatar)">
            <span class="text"><span class="label" :title="it.value.section ? undefined : it.value.label">{{ it.value.label }}</span></span>
            <kbd v-if="it.value.agent && !it.value.agent.installed">not installed</kbd>
            <!-- The same as the section's right-click, which the keyboard has -->
            <ButtonMenu v-if="it.value.section === 'agents'" :items="newAccountMenu"><button id="agentnew" class="icon small add" type="button" tabindex="-1"
              title="New Account…: of an agent, signed in with its own sign-in" aria-label="New Account" :disabled="!clis.length" @click.stop><Icon name="i-plus" /></button></ButtonMenu>
            <button v-else-if="it.value.page === 'github'" id="githubnew" class="icon small add" type="button" tabindex="-1" title="Add Account…: a GitHub account"
              aria-label="Add a GitHub account" @click.stop="newGithub"><Icon name="i-plus" /></button>
            <button v-else-if="it.value.section === 'profiles'" id="profilenew" class="icon small add" type="button" tabindex="-1" title="New Profile…" aria-label="New Profile"
              @click.stop="startNewProfile"><Icon name="i-plus" /></button>
          </TreeItem>
        </TreeRoot>
      </RightClickMenu>
      <!-- Enter makes it; Esc puts it away -->
      <input v-if="makingProfile" id="profilenewname" ref="newProfileField" v-model="newProfileName" data-name maxlength="64" placeholder="Its name, e.g. ann@shop.com"
        spellcheck="false" aria-label="New profile" @input="profilesError = ''" @keydown.enter.prevent="createProfile" @keydown.esc.stop.prevent="stopNewProfile">
      <p id="profileserror" class="error">{{ profilesError }}</p>
    </nav>

    <div v-show="tab === 'projects'" id="pjconfig">
      <template v-if="editing">
        <div id="pjhead" class="crumbs">
          <span>Projects</span><span aria-hidden="true">›</span><b id="pjtitle">{{ projects.find((p) => p.id === editing)?.name }}</b>
          <ButtonMenu :items="more" end><button id="pjmore" class="icon small" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
        </div>
        <!-- Enter saves it, not a form -->
        <div class="field"><label for="pjname">Name:</label>
          <input id="pjname" v-model="name" data-name maxlength="64" spellcheck="false" @input="error = ''" @change="saveLook" @keydown.enter.prevent="saveLook"></div>
        <p id="pjerror" class="error">{{ error }}</p>

        <section id="npreposrow" class="group">
          <h3 class="titled">Code</h3>
          <RightClickMenu :items="repoMenu">
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="codeMenu"><button id="npreposadd" class="icon small" type="button" title="Add a repository or folder" aria-label="Add code"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="nprepodel" class="icon small" type="button" title="Remove from the project (its folder stays)" aria-label="Remove from the project" :disabled="!repoSel" @click="removeRepo()"><Icon name="i-minus" /></button>
                <button id="nprepodefault" class="icon small" type="button" title="Make Default: new tasks' agents start in its copy" aria-label="Make Default"
                  :disabled="!repoSel || repoSel === repos[0]?.folder" @click="defaultRepo()"><Icon name="i-star" /></button>
              </div>
              <div v-if="repos.length" class="head" aria-hidden="true"><span>Name</span><span>Folder</span><span>GitHub</span><span /></div>
              <ListboxRoot selection-behavior="replace" v-if="repos.length" id="nprepos" v-model="repoSel" aria-label="Code" @keydown.delete="removeRepo()">
                <ListboxContent>
                  <ListboxItem v-for="(r, i) in repos" :key="r.folder" :value="r.folder" class="item" :data-folder="r.folder">
                    <span class="cell label" :title="base(r.folder)">{{ base(r.folder) }}</span><small class="cell" :title="r.folder">{{ r.folder }}</small>
                    <small class="cell github" :title="r.github ? `${r.github.repo}: ${r.github.login ? `as ${r.github.login}` : 'no account reaches it'}` : 'Not on GitHub'">{{ r.github?.login ?? '' }}</small>
                    <span class="cell end"><kbd v-if="r.git !== 'ok'" class="warn">{{ r.git === 'none' ? 'no git' : 'no commit yet' }}</kbd>
                      <kbd v-if="!i && repos.length > 1" class="default" title="New tasks' agents start in its copy">default</kbd></span>
                  </ListboxItem>
                </ListboxContent>
              </ListboxRoot>
              <p v-if="!repos.length" class="empty">No code yet: its tasks work in an empty folder.</p>
            </div>
          </RightClickMenu>
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
          <h3 class="titled">Team</h3>
          <RightClickMenu :items="agentRowMenu">
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="agentMenu"><button id="npagentadd" class="icon small" type="button" title="Add a role: an account and what it does" aria-label="Add a role"
                  :disabled="!!signing || (!addable.length && !choices.clis.length)"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="npagentdel" class="icon small" type="button" title="Remove from the team (its tasks keep it)" aria-label="Remove from the team" :disabled="!agentSel" @click="removeAgent()"><Icon name="i-minus" /></button>
                <button id="npagentdefault" class="icon small" type="button" :disabled="!agentSel" @click="starAgent()"
                  :title="isDefault(agentSel) ? 'No Default: a new task starts with no agent, you choose one there' : 'Make Default: a new task starts with it'"
                  :aria-label="isDefault(agentSel) ? 'No Default' : 'Make Default'"><Icon name="i-star" /></button>
              </div>
              <div v-if="mine.length" class="head" aria-hidden="true"><span>Role</span><span>Agent</span><span>Account</span><span /></div>
              <ListboxRoot selection-behavior="replace" v-if="mine.length" id="npagents" v-model="agentSel" aria-label="Team" @keydown.delete="removeAgent()">
                <ListboxContent>
                  <ListboxItem v-for="a in mine" :key="a.id" :value="a.id" class="item" :data-role="a.id" :data-agent="a.account"
                    :title="[a.role || a.name, a.about].filter(Boolean).join('\n')">
                    <span class="cell label role">{{ a.role || '—' }}</span>
                    <small class="cell"><Icon v-if="agentMark(a.cli, null)" :name="agentMark(a.cli, null)!" />{{ a.agent }}</small>
                    <small class="cell account" :class="{ warn: !a.account }">{{ a.account ? a.email ?? '—' : 'nobody here: Played by' }}</small>
                    <span class="cell end"><kbd v-if="a.place === 'project'" title="Kept in the repository (.kulisa/project.json): the same on every computer">shared</kbd>
                      <kbd v-if="a.default" class="default" title="A new task starts with it; the others are in the island's +">default</kbd></span>
                  </ListboxItem>
                </ListboxContent>
              </ListboxRoot>
              <p v-if="!mine.length && !signing" class="empty">No team yet: its tasks get the terminal only.</p>
            </div>
          </RightClickMenu>
          <div v-if="shownRole" class="roleform">
            <div class="field"><label for="nprolename">Role:</label><input id="nprolename" v-model="roleName" maxlength="40" spellcheck="false"
              placeholder="Its name on its tab, e.g. Builder, Checker (optional)" @change="saveRole" @keydown.enter.prevent="saveRole"></div>
            <div class="field top"><label for="nproleabout">It does:</label><textarea id="nproleabout" v-model="roleAbout" rows="2" maxlength="500"
              placeholder="In your words, e.g. checks every change on macOS and reports bugs to the builder (optional)" @change="saveRole" /></div>
            <div class="field"><label for="nproleplace">Kept in:</label>
              <ButtonMenu :items="placeMenu"><button id="nproleplace" type="button" class="select"
                title="Project: in the repository's .kulisa/project.json, the same on every computer once you commit it; This computer: here only">
                {{ PLACES[shownRole.place] }}<Icon name="i-down" /></button></ButtonMenu></div>
            <div v-if="shownRole.place === 'project'" class="field"><label for="nproleplayer">Played by:</label>
              <ButtonMenu :items="playerMenu"><button id="nproleplayer" type="button" class="select" title="Its account on this computer: each computer has its own">
                {{ shownRole.account ? shownRole.email ?? shownRole.name : 'Choose an account' }}<Icon name="i-down" /></button></ButtonMenu></div>
            <div class="field"><label for="nproleos">Works on:</label>
              <ButtonMenu :items="osMenu"><button id="nproleos" type="button" class="select" title="The OS it checks on: on your other computers, the one with it takes this role (Join Task)">
                {{ shownRole.os ? OS_NAMES[shownRole.os] : 'Any OS' }}<Icon name="i-down" /></button></ButtonMenu></div>
            <div v-if="shownRole.models.length" class="field"><label for="nprolemodel">Model:</label>
              <ButtonMenu :items="modelMenu"><button id="nprolemodel" type="button" class="select" title="The model it starts with; a tab's menu changes it for one conversation">
                {{ roleModel }}<Icon name="i-down" /></button></ButtonMenu></div>
          </div>
          <p v-if="repoTeam.exists" id="nprepoteam" class="hint">
            <span>{{ repoTeam.used ? `The roles marked shared are in ${repoTeam.file}: commit it, and your other computers have them.`
              : `The repository has ${repoTeam.file}${repoTeam.used === false ? ', not used here' : ''}: the words of its roles go to the agents as what they do. Use it if you trust who wrote it.` }}</span>
            <button id="nprepoteamuse" type="button" @click="useRepoTeam(!repoTeam.used)">{{ repoTeam.used ? 'Stop Using' : 'Use It' }}</button></p>
          <AccountSignIn v-if="signing && editing" :project="editing" :agent="signing" @done="signedIn" @close="signing = null" />
          <p id="npagenterror" class="error">{{ agentError }}</p>
        </section>

        <section id="npprofilesrow" class="group">
          <h3 class="titled">Profiles</h3>
          <RightClickMenu :items="profileRowMenu">
            <div class="list">
              <div class="tools">
                <ButtonMenu :items="profileMenu"><button id="npprofileadd" class="icon small" type="button"
                  title="Add a profile: the browser profiles its tasks test as, each task with its own copy" aria-label="Add a profile"><Icon name="i-plus" /></button></ButtonMenu>
                <button id="npprofiledel" class="icon small" type="button" title="Remove from the project (asks first)" aria-label="Remove from the project" :disabled="!profileSel" @click="removeProfile()"><Icon name="i-minus" /></button>
              </div>
              <div v-if="profiles.length" class="head" aria-hidden="true"><span>Name</span><span>About</span><span>Also in</span></div>
              <ListboxRoot selection-behavior="replace" v-if="profiles.length" id="npprofiles" v-model="profileSel" aria-label="Profiles" @keydown.delete="removeProfile()">
                <ListboxContent>
                  <ListboxItem v-for="p in profiles" :key="p.id" :value="p.id" class="item" :data-profile="p.id"
                    :title="[p.name, p.description, p.also.length && `also in ${p.also.join(', ')}`].filter(Boolean).join('\n')">
                    <span class="cell label"><img class="avatar" alt="" :src="avatarSrc(p.avatar)">{{ p.name }}</span>
                    <small class="cell about">{{ p.description }}</small><small class="cell also">{{ p.also.join(', ') }}</small>
                  </ListboxItem>
                </ListboxContent>
              </ListboxRoot>
              <p v-if="!profiles.length && adding !== 'profile'" class="empty">No profiles yet: the browser profiles its tasks test as, signed in once.</p>
            </div>
          </RightClickMenu>
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
      </div>
    </div>
    <div v-show="tab === 'profiles'" id="prconfig">
      <template v-if="shownProfile">
        <div class="crumbs">
          <span>Profiles</span><span aria-hidden="true">›</span><b>{{ shownProfile.name }}</b>
          <ButtonMenu :items="more" end><button id="profilemore" class="icon small" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
        </div>
        <ProfilePage :profile="shownProfile" @changed="profileChanged" />
      </template>
      <div v-else class="none">
        <p class="empty">No profiles yet.</p>
        <button type="button" @click="startNewProfile">New Profile…</button>
      </div>
    </div>
    <div v-show="tab === 'agents'" id="agconfig">
      <div v-if="shownAgent" class="crumbs">
        <span>Agents</span><span aria-hidden="true">›</span><b>{{ shownAgent.name }}</b>
        <ButtonMenu :items="more" end><button id="agentmore" class="icon small" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu>
      </div>
      <AgentPage ref="agentPage" :list="agentsList" :chosen="agentAt" :accounts :clis @accounts="showAccounts" />
    </div>
    <div v-show="tab === 'github'" id="ghconfig">
      <div class="crumbs"><b>GitHub</b>
        <ButtonMenu :items="more" end><button id="githubmore" class="icon small" type="button" title="More" aria-label="More"><Icon name="i-more" /></button></ButtonMenu></div>
      <GithubPage ref="githubPage" :shown="tab === 'github'" />
    </div>
    <div v-show="tab === 'log'" id="lgconfig">
      <div class="crumbs"><b>Log</b></div>
      <LogPage :shown="tab === 'log'" />
    </div>
    <div v-show="tab === 'about'" id="abconfig">
      <div class="crumbs"><b>About</b></div>
      <AboutPage :shown="tab === 'about'" />
    </div>
  </main>
</template>

<style>
/* The tree on the left, the chosen page on the right, each scrolling on its own (JetBrains' Settings) */
#projects { flex: 1; min-width: 0; min-height: 0; display: flex; background: var(--island);
  #pjnav { flex: none; width: 230px; display: flex; flex-direction: column; gap: 4px; overflow: hidden auto; padding: 4px; border-inline-end: 1px solid var(--island-hi);
    background: var(--window);
    #profilenewname { margin-inline-start: 26px; } .error { margin: 0 0 0 26px; &:empty { display: none; } } }
  #pjlist { margin: 0; padding: 0; outline: none;
    .item { min-height: var(--row); padding: 0 4px 0 8px; gap: var(--gap); border-radius: var(--radius); padding-inline-start: calc(8px + (var(--level, 1) - 1) * 18px); }
    [aria-level="2"] { --level: 2; }
    :is([data-section], [data-page]):not([data-page="about"], :first-child) { margin-top: var(--inset); } /* Log and About together, under the rest */
    .twist { width: 12px; height: 12px; color: var(--text-dim); } [aria-expanded="false"] .twist { rotate: -90deg; }
    .picon, .logo { flex: none; width: 16px; height: 16px; } .picon { color: var(--color); } .avatar { --avatar: 16px; }
    .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } kbd { flex: none; }
    [aria-selected="true"] { background: var(--chosen-idle); color: var(--text-strong); }
    &:focus-within [aria-selected="true"] { background: var(--chosen); } }
  /* More room than a dialog's, as JetBrains' Settings: along the sides, and between the groups, whose lists ran into
     the next one's title (the author, 2026-10-16) */
  :is(#pjconfig, #agconfig, #ghconfig, #prconfig, #lgconfig, #abconfig) { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--inset); overflow: hidden auto;
    padding: 0 calc(1.5 * var(--pad)) var(--pad);
    > * { flex: none; } }
  /* The log scrolls inside its box, the page not at all: its tools and buttons stay in sight */
  #lgconfig { overflow: hidden; > #logpage { flex: 1; min-height: 0; } }
  /* Where the page is in the tree, and what acts on it at its end */
  .crumbs { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: var(--gap); min-height: calc(var(--control) + 12px);
    background: var(--island); color: var(--text-muted);
    b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--text-strong); } }
  .field { margin-top: 0; }
  .group { display: flex; flex-direction: column; gap: var(--gap); margin-top: var(--pad);
    > .error, > .hint { margin: 0; } > .hint:not([hidden]) { margin-inline-start: calc(var(--label) + var(--inset)); } }
  .list [role="listbox"] { max-height: calc(6 * var(--row)); overflow: auto; }
  /* The columns: the name as wide as it needs (at most about half), what it is in the rest, its state at the end */
  #npreposrow .list { --cols: fit-content(40%) minmax(0, 1fr) fit-content(20%) auto; }
  #npagentsrow .list { --cols: fit-content(30%) fit-content(30%) minmax(0, 1fr) auto; }
  .roleform { margin-top: var(--inset); }
  #npprofilesrow .list { --cols: fit-content(45%) minmax(0, 1fr) fit-content(30%); }
  :is(#npformer, #nprepoteam) button { margin-inline-start: var(--gap); }
  .none { display: flex; flex-direction: column; align-items: start; gap: var(--gap); padding-top: var(--pad); .empty { margin: 0; } }
}
</style>
