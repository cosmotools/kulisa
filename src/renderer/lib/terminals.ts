// A tasks' window's terminals (docs/window.md, The terminal): the terminals themselves are src/terminal's, keyed
// "<task>#<id>" as in the main process; here the island's side: the shown task's terminal in front (Terminals.vue),
// links into its profiles, terminals moving to another window, their menus.
import { act, store } from './store';
import { ago, keyText } from './common';
import { menuAt, modelItems, type MenuItem } from './menu';
import { agentMark } from './agents';
import { dialog } from './dialogs';
import { restoreTerminal, serialized, termCopy, termHooks, termPaste, View, xtermKeys } from '../../terminal/renderer';
import type { ClosedConversation, Terminal as TerminalInfo } from '../../shared/types';

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

// The island's menus (Terminals.vue). The shown task's project's team (its roles), the default first, each by its name
// and the account playing it; the terminal only is the Terminal row.
const projectRoles = () => (store.projects.open.find((o) => o.id === store.projects.project)?.roles || []).filter((r) => r.cli !== 'shell');
const roleLabel = (r: ReturnType<typeof projectRoles>[number]) => (r.role ? `${r.role} · ${r.name}` : r.name);
// The task's closed conversations, gone on with (Task.closedConversations): its name, its account and when, a doubt
// said where the agent may take another of its own.
const closedTitle = (c: ClosedConversation) => `Go on with "${c.name}" (${c.account}, closed ${ago(c.closedAt)})` +
  (c.unsure ? `: its session is not known, so ${c.account} may go on with its conversation closed last instead` : '');
const continueIt = (c: ClosedConversation) => act('terminal:open', { conversation: c.i });
// The same as big buttons, the island alone in the grid: an account's name is its agent's · its email, on two lines;
// first the conversation closed last, which the keyboard is on (Terminals.vue).
export const launchers = () => [
  ...store.terminals.closed.slice(0, 1).map((c) => ({ id: `closed-${c.i}`, name: `Continue: ${c.name}`, sub: ago(c.closedAt),
    icon: agentMark(c.cli)!, title: closedTitle(c), run: () => continueIt(c) })),
  ...projectRoles().map((r) => {
    const [name, sub = ''] = r.role ? [r.role, r.name] : r.name.split(' · ');
    return { id: r.id, name, sub, icon: agentMark(r.cli)!, title: [roleLabel(r), r.about].filter(Boolean).join('\n'), run: () => act('terminal:open', { role: r.id }) };
  }),
  { id: 'shell', name: 'Terminal', sub: '', icon: 'i-agent-shell', title: 'Terminal', run: () => act('terminal:open') },
];
// +: a closed conversation gone on with, a new conversation of one of the agents, or a shell.
export const newTerminalItems = (): MenuItem[] => [
  ...(store.terminals.closed.length ? [{ heading: 'Closed Conversations' },
    ...store.terminals.closed.map((c) => ({ label: c.name, sub: `${c.account} · ${ago(c.closedAt)}`, icon: agentMark(c.cli)!, title: closedTitle(c),
      run: () => continueIt(c) })), '-' as const] : []),
  ...projectRoles().map((r) => ({ label: roleLabel(r), icon: agentMark(r.cli)!, title: r.about, run: () => act('terminal:open', { role: r.id }) })),
  ...(projectRoles().length ? ['-' as const] : []),
  { label: 'Terminal', icon: 'i-agent-shell', keys: keyText('terminal.new'), run: () => act('terminal:open') },
];
// What a tab's menu and its terminal's end with: another model goes on with the same conversation in the same tab.
export const tabItems = (t: TerminalInfo): MenuItem[] => [
  ...(t.agent ? [
    { label: 'Change agent…', run: () => { void dialog('handover').then((d) => d.open(t)); } },
    ...(t.agent.models.length ? [{ submenu: 'Model', items: modelItems(t.agent.models, t.agent.model, (model) => act('agent:model', { id: t.id, model })) }] : []),
    { label: 'New Conversation', run: () => act('agent:new-conversation', { id: t.id }) },
    '-' as const,
  ] : []),
  { label: 'Close', run: () => act('terminal:close', { id: t.id }) },
];
