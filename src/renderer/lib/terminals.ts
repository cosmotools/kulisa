// A tasks' window's terminals (docs/window.md, The terminal): the terminals themselves are src/terminal's, keyed
// "<task>#<id>" as in the main process; here the island's side: the shown task's terminal in front (Terminals.vue),
// links into its profiles, terminals moving to another window, their menus.
import { act, store } from './store';
import { keyText } from './common';
import { menuAt, type MenuItem } from './menu';
import { agentMark } from './agents';
import { dialog } from './dialogs';
import { refused } from '../../shared/result';
import { restoreTerminal, serialized, termCopy, termHooks, termPaste, View, xtermKeys } from '../../terminal/renderer';
import type { Terminal as TerminalInfo } from '../../shared/types';

// The terminal in front of the shown task's island: where the keyboard goes (Ctrl+`), what the tests read.
const frontKey = () => (store.current && store.terminals.front !== null ? `${store.current}#${store.terminals.front}` : null);
// The island's xterm, one for the window: Terminals.vue puts it in whichever grid is shown.
export const island = new View();
export const shownTerm = () => (island.key && island.key === frontKey() ? island.term : null);
const sizes: { cols: number; rows: number }[] = [];
Object.defineProperty(window, '__term', { get: shownTerm }); // for tests
Object.defineProperty(window, '__termRenderer', { get: () => shownTerm() && island.renderer }); // for tests
Object.assign(window, { __ptySizes: sizes }); // for tests: the sizes sent for the shown task's terminals
termHooks.fitted = (key, size) => { if (key === frontKey()) sizes.push(size); };

// Links in the terminal: those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (the web-links
// addon). Ctrl+click (⌘ on macOS) asks where, in a menu at the pointer: a tab of one of the shown task's open
// profiles, or the user's browser. Always asked, so a link never opens somewhere unexpected (the author's choice:
// which profile a link belongs to cannot be told).
termHooks.open = (e, uri) => menuAt(e, [{ heading: uri }, ...store.profiles.map((p) => ({ label: `Open in ${p.name}`, avatar: p.avatar,
  run: () => act('tab:new', { profile: p.id, url: uri }) })),
'-', { label: 'Open in your browser', run: () => { window.open(uri); } }]);

// Paths in the terminal that exist (the task's folder is the main process's), as links, and the files an agent marks
// as links: Ctrl+click asks what to do, in the same menu: open it in the OS's app, or show it in its folder; what
// would run when opened, shown only. Asked again on the click: the file may be gone, or changed, since the hover.
const filesOf = (task: string | null, paths: string[]) => kulisa.invoke('terminal:files', { task, paths }).then((r) => (refused(r) ? paths.map(() => null) : r));
termHooks.files = (key, paths) => filesOf(key.slice(0, key.lastIndexOf('#')), paths);
termHooks.openFile = (e, path) => void filesOf(store.current, [path]).then(([file]) => file && menuAt(e, [{ heading: file.path },
  ...file.executable ? [] : [{ label: 'Open', run: () => kulisa.invoke('file:open', file.path) }],
  { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file.path) }]));

// Their contents as escape sequences (xterm's serialize addon, as VS Code keeps terminals across reloads), which
// another window writes into new terminals: a project moving there keeps what its agents showed. Each with its size:
// written into a terminal of another size (xterm's default before it fits its panel), the lines of an agent's screen
// would be cut and its prompt drawn in pieces.
export const terminalsOf = (task: string) => Object.fromEntries([...xtermKeys()].filter((key) => key.startsWith(`${task}#`))
  .map((key) => [key, serialized(key)!]));
kulisa.on('terminals:restore', (list) => { for (const [key, t] of Object.entries(list)) restoreTerminal(key, t); });

kulisa.on('terminal:focus', () => shownTerm()?.focus());

// The right-click menu of a terminal (its key): an agent's ends with what its tab's menu has (Terminals.vue), a
// shell's with Close.
export function terminalMenu(key: string, more: MenuItem[]): MenuItem[] | null {
  const t = island.key === key ? island.term : null;
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

// The island's menus (Terminals.vue). The shown task's project's agents (its accounts), the default first; the terminal
// only is the Terminal row.
const projectAgents = () => (store.projects.open.find((o) => o.id === store.projects.project)?.agents || []).filter((a) => a.cli !== 'shell');
// The same as big buttons, the island alone in the grid: an account's name is its agent's · its email, on two lines.
export const launchers = () => [
  ...projectAgents().map((a) => {
    const [name, sub = ''] = a.name.split(' · ');
    return { id: a.id, name, sub, icon: agentMark(a.cli)!, title: a.name, run: () => act('terminal:open', { agent: a.id }) };
  }),
  { id: 'shell', name: 'Terminal', sub: '', icon: 'i-agent-shell', title: 'Terminal', run: () => act('terminal:open') },
];
// +: a new conversation of one of them, or a shell.
export const newTerminalItems = (): MenuItem[] => [
  ...projectAgents().map((a) => ({ label: a.name, icon: agentMark(a.cli)!, run: () => act('terminal:open', { agent: a.id }) })),
  ...(projectAgents().length ? ['-' as const] : []),
  { label: 'Terminal', icon: 'i-agent-shell', keys: keyText('terminal.new'), run: () => act('terminal:open') },
];
// What a tab's menu and its terminal's end with.
export const tabItems = (t: TerminalInfo): MenuItem[] => [
  ...(t.agent ? [
    { label: 'Change agent…', run: () => { void dialog('handover').then((d) => d.open(t)); } },
    { label: 'New Conversation', run: () => act('agent:new-conversation', { id: t.id }) },
    '-' as const,
  ] : []),
  { label: 'Close', run: () => act('terminal:close', { id: t.id }) },
];
