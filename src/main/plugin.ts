// Supplies core actions and current facts to the Kulisa plugin (src/kulisa-plugin/README.md).
import type { Shell } from './shell.ts';
import type { Task, DevelopmentTerminal } from './tasks.ts';
import { toUrl } from '../browser/main/index.ts';
import type { Profile, Tab } from '../browser/main/index.ts';
import { progress } from './worktrees.ts';
import { ARTIFACTS_LIMIT, listArtifacts } from './artifacts.ts';
import { fromLocalTool } from './local-only.ts';
import { refused } from '../shared/result.ts';
import type { PluginHost, TaskAccess, ProfileAccess, TabAccess, DevelopmentTerminalAccess } from '../kulisa-plugin/main/index.ts';

const tabs = new WeakMap<Tab, TabAccess>();
function tabAccess(t: Tab): TabAccess {
  let access = tabs.get(t);
  if (access) return access;
  access = {
    get id() { return t.id; }, get title() { return t.title; }, get url() { return t.url; },
    get ready() { return t.ready; }, get alive() { return !!t.discarded || !t.wc.isDestroyed(); },
    get dialog() { return t.dialog; },
    get agentDialogs() { return t.agentDialogs; }, set agentDialogs(value) { t.agentDialogs = value; },
    canGoBack: () => t.wc.navigationHistory.canGoBack(),
    canGoForward: () => t.wc.navigationHistory.canGoForward(),
    onInput: (listener) => {
      const onInput = (_e: Electron.Event, input: Electron.InputEvent) => listener(input.type);
      t.wc.on('input-event', onInput);
      return () => { if (!t.wc.isDestroyed()) t.wc.off('input-event', onInput); };
    },
  };
  tabs.set(t, access);
  return access;
}
const profiles = new WeakMap<Profile, ProfileAccess>();
function profileAccess(p: Profile): ProfileAccess {
  let access = profiles.get(p);
  if (access) return access;
  access = {
    get id() { return p.id; }, get name() { return p.name; }, get description() { return p.description; },
    get avatar() { return p.avatar; }, get login() { return p.login; }, get hasPassword() { return p.hasPassword; },
    get signinMode() { return p.signinMode; }, get resuming() { return !!p.resuming; }, get deleted() { return p.deleted; },
    get active() { return p.active; }, get tabs() { return p.tabs.map(tabAccess); },
    get currentUrl() { return p.get()!.wc.getURL(); },
    navigate: async (url) => {
      const wc = p.get()!.wc;
      p.navigate(undefined, url);
      await new Promise<void>((ok) => {
        const done = () => { clearTimeout(timer); wc.off('did-stop-loading', done); ok(); };
        const timer = setTimeout(done, 10_000);
        wc.once('did-stop-loading', done);
      });
    },
    newTab: (url) => tabAccess(p.newTab(url)), activate: (id) => p.activate(id), closeTab: (id) => p.closeTab(id),
    page: (id) => p.page(id),
  };
  profiles.set(p, access);
  return access;
}
const tasks = new WeakMap<Task, TaskAccess>();
function taskAccess(task: Task): TaskAccess {
  let access = tasks.get(task);
  if (access) return access;
  access = {
    stageTerminals: {
      info: () => task.stageTerminals.info(), run: (name, command, size) => task.stageTerminals.run(name, command, size),
      resize: (which, size) => task.stageTerminals.configure(which, { size }),
      stop: (which) => task.stageTerminals.stop(which), close: (which) => task.stageTerminals.close(which),
      read: (which, lines, screenOnly) => task.stageTerminals.read(which, lines, screenOnly), input: (which, input) => task.stageTerminals.input(which, input),
    },
    get key() { return task.key; }, get name() { return task.name; }, get folder() { return task.folder; },
    get branch() { return task.branch; }, get worktrees() { return task.worktrees.map(({ folder, repo, branch }) => ({ folder, repo, branch })); },
    get profiles() { return new Map([...task.profiles].map(([id, p]) => [id, profileAccess(p)])); },
    get closed() { return new Map([...task.closed].map(([id, { cfg, tabs }]) => [id, {
      cfg: { id, name: cfg.name, avatar: cfg.avatar, description: cfg.description, login: cfg.login, hasPassword: cfg.hasPassword },
      tabs: { urls: tabs.urls },
    }])); }, artifactLimit: ARTIFACTS_LIMIT,
    arrangeStage: (layout, overflow, position) => task.arrangeStage(layout, overflow, position),
    dirs: () => task.dirs(), addable: () => task.addable(), inGit: () => task.inGit(),
    named: (name) => task.named(name),
    find: (id) => { const r = task.find(id); return refused(r) ? r : { profile: profileAccess(r.profile) }; },
    findTab: (id, tab) => { const r = task.findTab(id, tab); return refused(r) ? r : { profile: profileAccess(r.profile), tab: tabAccess(r.tab) }; },
    createProfile: (name, description) => task.createProfile(name, description),
    renameProfile: (id, name) => task.renameProfile(id, name), describeProfile: (id, description) => task.describeProfile(id, description),
    openProfile: (id) => task.openProfile(id), closeProfile: (id) => task.closeProfile(id), deleteProfile: (id) => task.deleteProfile(id, 'agent'),
    setLogin: (id, login, password) => task.setLogin(id, login, password),
    typeLogin: async (id, tab, field, fill) => {
      const r = task.loginFor(id, tab, field);
      if (refused(r)) return r;
      const key = `${task.key}/${r.profile.id}`;
      task.shell.typingSecret.add(key);
      try { return { name: r.profile.name, result: await fill(r.value) }; } finally { task.shell.typingSecret.delete(key); }
    },
    environmentUsed: (environment) => task.environmentUsed(environment),
    caption: (profile, caption, sticky) => task.caption(profile, caption, sticky), toUrl,
    screenshot: (profile, tab, shot) => task.screenshot(profile, tab, shot),
    saveArtifact: (source, kind, content) => task.saveArtifact(source, kind, content),
    artifacts: () => listArtifacts(task.store.artifacts), artifactsUsage: (scope) => task.artifactsUsage(scope),
    deleteArtifacts: (files) => task.deleteArtifacts(files), rename: (name) => task.rename(name),
    makeWorktree: (name) => task.makeWorktree(name), addRepository: (repo) => task.addRepository(repo), removeRepository: (repo) => task.removeRepository(repo),
    codeProgress: () => Promise.all(task.worktrees.map(async (c) => ({ folder: c.folder, repo: c.repo, ...await progress(c) }))),
    conversations: () => task.conversations().map((c) => {
      const agent = task.shell.agentFor(c.agent, { any: true }), t = c.terminal === undefined ? undefined : task.developmentTerminals.get(c.terminal);
      const name = agent?.name || c.agent || 'an agent';
      return { from: c.from, to: c.to, transcript: c.transcript, name, tab: t ? task.label(t) : c.title || agent?.cli || name,
        open: !!t, read: agent?.conversation };
    }),
    developmentTerminalsInfo: () => ({ list: task.developmentTerminalsInfo().list.map(({ name, agent, by, command }) => ({ name, agent: !!agent, by, command })) }),
    runInTerminal: (name, command) => task.runInTerminal(name, command),
    readTerminal: (name, lines) => task.readTerminal(name, lines), closeTerminal: (name) => task.closeTerminal(name),
    interruptTerminal: (name) => task.interruptTerminal(name),
  };
  tasks.set(task, access);
  return access;
}
function terminalAccess(task: Task, t: DevelopmentTerminal): DevelopmentTerminalAccess {
  return {
    id: t.id, agent: !!t.agent, get state() { return t.state; },
    saveSession: (session) => task.saveSession(t, session), noteAutoTitle: () => task.noteAutoTitle(t),
    setState: (state) => task.setState(t, state), followAutoTitle: () => task.followAutoTitle(t),
    historyRead: (conversation, part, parts) => task.historyRead(t, conversation, part, parts),
    nameConversation: (name) => task.nameConversation(t, name),
  };
}
function pluginHost(shell: Shell): PluginHost {
  return {
    resolve: (project, id, terminal) => {
      const task = shell.taskOf(project, id);
      if (!task?.loaded) return null;
      const t = terminal === undefined ? undefined : task.developmentTerminals.get(terminal);
      return { task: taskAccess(task), terminal: t ? terminalAccess(task, t) : null };
    },
    allowRequest: fromLocalTool, dictated: (text) => shell.dictation.dictated(text),
    onProfileUnloading: (listener) => { shell.bus.on('profile-unloading', listener); },
    contexts: () => [...shell.open.values()].flatMap((p) => [...p.tasks.values()].flatMap((t) => [...t.profiles.values()].map((p) => p.context))),
    onContext: (listener) => { shell.bus.on('profile-added', (p: Profile) => listener(p.context)); },
    onCommand: (listener) => { shell.bus.on('agent-command', listener); },
    typingSecret: (key) => shell.typingSecret.has(key),
    showAction: (action) => { shell.taskByKey(action.task)?.window?.send('agent', action); },
    noteAction: (action) => { shell.bus.emit('agent-action', action); },
  };
}

export { pluginHost, taskAccess, terminalAccess };
