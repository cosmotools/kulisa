// A tasks' window's terminals (docs/window.md, The terminal): the terminals themselves are src/terminal's, keyed
// "<task>#<id>" as in the main process; here the terminals' side: the shown task's terminal in front (task-view/DevelopmentTerminals.tsx),
// links into its profiles and terminal menus. The task UI itself moves between windows.
import { store, shownTask, actionsFor } from './state';
import { termStyle } from '../../appearance/renderer';
import { keyText } from '../../window-client/renderer';
import { menuAt, type MenuItem } from '../../menus/renderer';
import { taskGrid } from './controller';
import { refused } from '../../shared/result';
import { termCopy, termHooks, termPaste, View } from '../../terminal/renderer';
import type { DevelopmentTerminalInfo } from '../../shared/types';

// The terminal in front of the shown task's terminals: where the keyboard goes (Ctrl+`), what the tests read.
const frontKey = () => { const { task, front } = store.getState().developmentTerminals; return task && front !== null ? `${task}#${front}` : null; };
// One development View per task UI; its session changes within this task and its identity survives window transfer.
export const panelView = new View(termStyle());
export const shownTerm = () => (taskGrid(store.getState().current)?.development.screen() === 'terminals' && panelView.key && panelView.key === frontKey() ? panelView.term : null);

export function focusDevelopmentTerminal(task = store.getState().current) {
  const development = taskGrid(task)?.development;
  if (!development || store.getState().current !== task) return;
  development.showItem('terminals');
  store.setState({ developmentTerminalFocus: {} });
}

export async function showDevelopmentTerminal(task: string, id: number) {
  await actionsFor(task)('development-terminal:show', { id });
  if (store.getState().developmentTerminals.front === id) focusDevelopmentTerminal(task);
}

termHooks.colors = () => termStyle().colors;

// Links in the terminal: those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (the web-links
// addon). Ctrl+click (⌘ on macOS) asks where, in a menu at the pointer: a tab of one of the shown task's open
// profiles, or the user's browser. Always asked, so a link never opens somewhere unexpected (the author's choice:
// which profile a link belongs to cannot be told).
termHooks.open = (e, uri) => {
  const { key, profiles } = store.getState(), act = actionsFor(key);
  menuAt(e, [{ heading: uri }, ...profiles.map((p) => ({ label: `Open in ${p.name}`, avatar: p.avatar,
    run: () => act('tab:new', { profile: p.id, url: uri }) })),
  '-', { label: 'Open in your browser', run: () => { window.open(uri); } }]);
};

// Paths in the terminal that exist (the task's folder is the main process's), as links, and the files an agent marks
// as links: Ctrl+click asks what to do, in the same menu: open it in the OS's app, or show it in its folder; what
// would run when opened, shown only. Asked again on the click: the file may be gone, or changed, since the hover.
const filesOf = (task: string | null, paths: string[]) => kulisa.invoke('terminal:files', { task, paths }).then((r) => (refused(r) ? paths.map(() => null) : r));
termHooks.files = (key, paths) => filesOf(key.slice(0, key.lastIndexOf('#')), paths);
termHooks.pasteImage = (key) => {
  const at = key.lastIndexOf('#');
  void kulisa.invoke('development-terminal:paste-image', { task: key.slice(0, at), id: Number(key.slice(at + 1)) });
};
termHooks.openFile = (e, path) => {
  const task = store.getState().current;
  void filesOf(task, [path]).then(([file]) => file && store.getState().current === task && menuAt(e, [
    ...file.executable ? [] : [{ label: 'Open', run: () => kulisa.invoke('file:open', file.path) }],
    { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file.path) }]));
};

kulisa.on('development-terminal:focus', () => focusDevelopmentTerminal());

// The right-click menu of a terminal (its key): an agent's ends with what its Side bar item's menu has, a
// shell's with Close.
export function terminalMenu(key: string, more: MenuItem[]): MenuItem[] | null {
  const t = panelView.key === key ? panelView.term : null;
  if (!t) return null;
  return [
    { label: 'Copy', keys: keyText('terminal.copy'), enabled: t.hasSelection(), run: () => termCopy(t) },
    { label: 'Paste', keys: keyText('terminal.paste'), run: () => termPaste(t) },
    { label: 'Select all', run: () => t.selectAll() },
    '-',
    { label: 'Clear', run: () => t.clear() },
    '-',
    ...more,
  ];
}

// The terminal creation menus. The owning task's project's agents (its accounts), the default first; the terminal
// only is the Terminal row.
const projectAgents = (task: string) => {
  const state = store.getState(), project = shownTask(state, task)?.project;
  return (state.projects.open.find((o) => o.id === project)?.agents ?? []).filter((a) => a.cli !== 'shell');
};
// The same as big buttons, the terminals alone in the grid: an account's name is its agent's · its email, on two lines.
export const launchers = (task: string) => [
  ...projectAgents(task).map((a) => {
    const [name, sub = ''] = a.name.split(' · ');
    return { id: a.id, name, sub, cli: a.cli, title: a.name, run: () => actionsFor(task)('development-terminal:open', { agent: a.id }) };
  }),
  { id: 'shell', name: 'Terminal', sub: '', cli: 'shell', title: 'Terminal', run: () => actionsFor(task)('development-terminal:open') },
];
// +: a new conversation of one of them, or a shell.
export const newTerminalItems = (task: string): MenuItem[] => [
  ...projectAgents(task).map((a) => ({ label: a.name, agent: a.cli, run: () => actionsFor(task)('development-terminal:open', { agent: a.id }) })),
  ...(projectAgents(task).length ? ['-' as const] : []),
  { label: 'Terminal', agent: 'shell', keys: keyText('terminal.new'), run: () => actionsFor(task)('development-terminal:open') },
];
// Shared actions in a terminal’s Side bar item and screen menu.
export const terminalItems = (task: string, t: DevelopmentTerminalInfo): MenuItem[] => [
  ...(t.agent ? [
    { label: 'Change agent…', run: () => kulisa.invoke('shell:dialog', { kind: 'handover', task, terminal: t }) },
    { label: 'New Conversation', run: () => actionsFor(task)('agent:new-conversation', { id: t.id }) },
    '-' as const,
  ] : []),
  { label: 'Close', run: () => actionsFor(task)('development-terminal:close', { id: t.id }) },
];
