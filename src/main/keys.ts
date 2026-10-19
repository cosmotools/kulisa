// Kulisa's keyboard shortcuts: one table of what each key does, and which key an input event is. The main process
// takes every key before the page it was typed in (before-input-event on the window and on every tab: shortcuts.ts), so a
// site or the terminal never gets a key that is Kulisa's, and a key that is not Kulisa's is left to them, untouched.
// Electron's application menu was tried for it and left (docs/window.md, Keys): on Linux it gets a key only after the
// page, and not at all when the page handled it, as xterm and many web apps do.
//
// Who gets a key depends on where the keyboard focus is (zone):
//   page      a profile's page, or its pane (address bar, toolbar): Chrome's keys act on that pane, as in Chrome
//   global    everywhere, the terminal too: Ctrl+Shift+… and Ctrl+`, which agents and sites do not use
//   terminal  every other key is the agent's (Ctrl+R, Ctrl+T, Alt+V …): Kulisa takes only the global ones
// A key in both groups (the zoom, DevTools) means the nearest one: in a page the page's, elsewhere Kulisa's.
//
// Keys are written as Electron's accelerators (tutorial/keyboard-shortcuts.md): CommandOrControl is ⌘ on macOS and
// Ctrl elsewhere; Command only on macOS. Letters are matched by what the key types on a Latin layout (Ctrl+W is the W of
// an AZERTY keyboard too), by their place on others (Ctrl+Е on a Russian one is Ctrl+T); digits and keys typed with
// Shift by their place.

// keys: shown in the window (menus, the shortcuts' dialog); also: matched, not shown; mac: instead of keys on macOS.
// range: keys standing for 1, 2, 3 … (the match says which: n). window: the keyboard goes to the window first (the
// command puts it in the window's HTML). always: also while a dialog is open. main: done in the main process.
// display: only shown, the window does it (the terminal's copy and paste: src/terminal/renderer).
// The zoom's and DevTools' keys mean the nearest: a page's own in a page, Kulisa's elsewhere.
import type { Shortcut } from '../shared/types.ts';

type Platform = NodeJS.Platform;
type Group = 'global' | 'page' | 'terminal';
interface Keys { keys: string[]; also?: string[]; mac?: string[]; win32?: string[]; main?: boolean }
interface Binding extends Keys {
  id: string; group: Group; label: string | null; range?: boolean; window?: boolean; always?: boolean; display?: boolean; hold?: boolean;
}
// An accelerator as the input it stands for.
interface Key { control: boolean; alt: boolean; shift: boolean; meta: boolean; key: string }
// What an input event is (Electron's Input, or as the tests give it).
interface Typed { type?: string; key?: string; code?: string; control?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; isAutoRepeat?: boolean; location?: number }
const ZOOM_IN: Keys = { keys: ['CommandOrControl+='], also: ['CommandOrControl+Shift+=', 'CommandOrControl+Plus', 'CommandOrControl+numadd'], main: true };
const ZOOM_OUT: Keys = { keys: ['CommandOrControl+-'], also: ['CommandOrControl+numsub'], main: true };
const ZOOM_RESET: Keys = { keys: ['CommandOrControl+0'], also: ['CommandOrControl+num0'], main: true };
const DEVTOOLS: Keys = { keys: ['F12', 'CommandOrControl+Shift+I'], mac: ['F12', 'Command+Alt+I'], main: true };
const KEYS: Binding[] = [
  { id: 'terminal.focus', group: 'global', label: 'The agent\'s terminal, and back to the page', keys: ['Control+`'], window: true },
  { id: 'terminal.new', group: 'global', label: 'New terminal', keys: ['Control+Shift+`'], window: true },
  { id: 'task.n', group: 'global', label: "Tab 1 to 9 of the tasks' bar", range: true,
    keys: digits('CommandOrControl+Shift+', 1, 9), mac: digits('Command+Alt+', 1, 9) }, // ⌘⇧3, 4, 5: macOS's screenshots
  { id: 'task.next', group: 'global', label: 'Next task in the bar', keys: ['CommandOrControl+Shift+PageDown'] },
  { id: 'task.previous', group: 'global', label: 'Previous task', keys: ['CommandOrControl+Shift+PageUp'] },
  { id: 'task.new', group: 'global', label: 'New task of the same project', keys: ['CommandOrControl+Shift+N'], window: true },
  { id: 'task.menu', group: 'global', label: 'New task: of which project, or a closed one', keys: ['CommandOrControl+Shift+A'], window: true }, // the bar's +
  { id: 'shortcuts', group: 'global', label: 'Keyboard shortcuts', keys: ['CommandOrControl+Shift+/'], window: true },
  { id: 'zoom.in', group: 'global', label: 'Zoom Kulisa in', ...ZOOM_IN, always: true },
  { id: 'zoom.out', group: 'global', label: 'Zoom Kulisa out', ...ZOOM_OUT, always: true },
  { id: 'zoom.reset', group: 'global', label: 'Kulisa\'s zoom back to 100%', ...ZOOM_RESET, always: true },
  { id: 'devtools.app', group: 'global', label: null, ...DEVTOOLS, always: true }, // Kulisa's own, from source only
  // The right Ctrl (⌘ on macOS: Apple keyboards have no right Ctrl): a modifier alone types nothing and does nothing
  // anywhere, so it is held in a page, the terminal or the bar alike, at the right hand's edge, as push-to-talk keys are.
  { id: 'voice.hold', group: 'global', label: 'Speak to the agent: hold, or press once and again', keys: ['ControlRight'], mac: ['MetaRight'], hold: true },

  { id: 'tab.new', group: 'page', label: 'New tab', keys: ['CommandOrControl+T'], window: true },
  { id: 'tab.close', group: 'page', label: 'Close the tab', keys: ['CommandOrControl+W'], also: ['CommandOrControl+F4'], mac: ['Command+W'] },
  { id: 'tab.reopen', group: 'page', label: 'Open the tab closed last', keys: ['CommandOrControl+Shift+T'] },
  { id: 'tab.address', group: 'page', label: 'The address bar', keys: ['CommandOrControl+L', 'Alt+D', 'F6'], mac: ['Command+L', 'F6'], window: true },
  { id: 'tab.reload', group: 'page', label: 'Reload', keys: ['CommandOrControl+R', 'F5'], mac: ['Command+R'] },
  { id: 'tab.reloadAll', group: 'page', label: 'Reload, not from the cache', keys: ['CommandOrControl+Shift+R', 'Shift+F5'], also: ['CommandOrControl+F5'], mac: ['Command+Shift+R'] },
  { id: 'tab.back', group: 'page', label: 'Back', keys: ['Alt+Left'], mac: ['Command+[', 'Command+Left'] },
  { id: 'tab.forward', group: 'page', label: 'Forward', keys: ['Alt+Right'], mac: ['Command+]', 'Command+Right'] },
  { id: 'tab.next', group: 'page', label: 'Next tab', keys: ['Control+Tab', 'CommandOrControl+PageDown'], mac: ['Control+Tab', 'Command+Alt+Right'] },
  { id: 'tab.previous', group: 'page', label: 'Previous tab', keys: ['Control+Shift+Tab', 'CommandOrControl+PageUp'], mac: ['Control+Shift+Tab', 'Command+Alt+Left'] },
  { id: 'tab.n', group: 'page', label: 'Tab 1 to 8', range: true, keys: digits('CommandOrControl+', 1, 8) },
  { id: 'tab.last', group: 'page', label: 'The last tab', keys: ['CommandOrControl+9'] },
  { id: 'pick', group: 'page', label: 'Pick an element for the agent', keys: ['CommandOrControl+Shift+C'] },
  { id: 'screenshot', group: 'page', label: 'Screenshot of an element', keys: ['CommandOrControl+Shift+S'] },
  { id: 'site.zoomIn', group: 'page', label: 'Zoom the site in', ...ZOOM_IN },
  { id: 'site.zoomOut', group: 'page', label: 'Zoom the site out', ...ZOOM_OUT },
  { id: 'site.zoomReset', group: 'page', label: 'The site\'s zoom back', ...ZOOM_RESET },
  { id: 'devtools.tab', group: 'page', label: 'DevTools of the tab', ...DEVTOOLS },

  { id: 'terminal.copy', group: 'terminal', label: 'Copy', display: true, keys: ['Control+Shift+C'], win32: ['Control+C'], mac: ['Command+C'] },
  { id: 'terminal.paste', group: 'terminal', label: 'Paste', display: true, keys: ['Control+Shift+V'], win32: ['Control+V'], mac: ['Command+V'] },
];
function digits(prefix: string, from: number, to: number) { return Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i)); }

// The US keyboard's character of a key by its place: keys typed with Shift, and layouts whose keys type other ones.
const US: Record<string, string> = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
  Quote: '\'', Comma: ',', Period: '.', Slash: '/' };
const NAMED: Record<string, string> = { arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down', ' ': 'space' };
const NUMPAD: Record<string, string> = { NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec' };

// The key of an input event (Electron's Input: key, code, control, shift, alt, meta), as an accelerator names it.
function keyOf({ key = '', code = '', shift }: Typed): string {
  if (NUMPAD[code]) return NUMPAD[code];
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`;
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^[a-z]$/i.test(key)) return key.toLowerCase();
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (key.length === 1 && key.charCodeAt(0) < 128 && !shift) return key;
  if (US[code]) return US[code];
  return NAMED[key.toLowerCase()] ?? key.toLowerCase();
}

// An accelerator as the input it stands for on a platform: { control, alt, shift, meta, key }; null where it does not
// exist (Command elsewhere than on macOS).
function parse(accelerator: string, platform: Platform): Key | null {
  const mac = platform === 'darwin';
  const parts = accelerator.split(/\+(?!$)/); // the last part may be '+' itself ("Ctrl++")
  const k: Key = { control: false, alt: false, shift: false, meta: false, key: parts.pop()!.toLowerCase() };
  if (k.key === 'plus') k.key = '+';
  if (k.key === 'esc') k.key = 'escape';
  if (k.key === 'return') k.key = 'enter';
  for (const m of parts.map((x) => x.toLowerCase())) {
    if (m === 'commandorcontrol' || m === 'cmdorctrl') k[mac ? 'meta' : 'control'] = true;
    else if (m === 'command' || m === 'cmd') { if (!mac) return null; k.meta = true; }
    else if (m === 'control' || m === 'ctrl') k.control = true;
    else if (m === 'alt' || m === 'option') k.alt = true;
    else if (m === 'shift') k.shift = true;
    else if (m === 'super' || m === 'meta') k.meta = true;
    else throw new Error(`unknown modifier ${m} in ${accelerator}`);
  }
  return k;
}

// A binding's keys on a platform: { shown, matched }.
function keysOf(b: Binding, platform: Platform) {
  const shown = (platform === 'darwin' && b.mac) || (platform === 'win32' && b.win32) || b.keys;
  return { shown, matched: platform === 'darwin' && b.mac ? b.mac : [...shown, ...(b.also || [])] };
}

// The bindings of a platform, each key parsed once; a hold binding's key the human's choice (custom: id -> code) or its own.
function keymap(platform = process.platform, custom: Record<string, string> = {}) {
  return KEYS.map((b) => ({ ...b, code: b.hold ? custom[b.id] || keysOf(b, platform).shown[0]! : null,
    chords: b.hold ? [] : keysOf(b, platform).matched.map((a, i) => ({ a, i, k: parse(a, platform) }))
      .filter((c): c is { a: string; i: number; k: Key } => !!c.k) }));
}
// A key's code by itself: a modifier by its side, an F key, or a key that types nothing (hold bindings, keys:set).
const MODIFIER = /^(Control|Shift|Alt|Meta)(Left|Right)$/;
const HOLDABLE = /^(Control|Shift|Alt|Meta)(Left|Right)$|^F\d{1,2}$|^(Insert|Pause|ScrollLock|ContextMenu)$/;
function holdable(map: ReturnType<typeof keymap>, code: string): string | null {
  if (!HOLDABLE.test(code)) return 'Press a key that types nothing: a Ctrl, Shift, Alt or ⌘ by its side, an F key, Insert, Pause or Scroll Lock';
  const taken = map.filter((b) => b.chords.some(({ k }) => k.key === code.toLowerCase() && !k.control && !k.alt && !k.shift && !k.meta));
  return taken.length ? `${codeName(code)} is already ${taken.find((b) => b.label)?.label || 'a key of Kulisa'}` : null;
}
// A hold binding's press or release: { id, down }; a key's repeats while held are not presses.
function held(map: ReturnType<typeof keymap>, input: Typed) {
  if (input.isAutoRepeat || (input.type !== 'keyDown' && input.type !== 'keyUp')) return null;
  // A modifier's side from where it says it is (KeyboardEvent.location: 1 left, 2 right): a sent event (the tests')
  // has a side but no code.
  const side = { 1: 'Left', 2: 'Right' }[input.location ?? 0];
  const code = side && /^(Control|Shift|Alt|Meta)$/.test(input.key ?? '') ? `${input.key}${side}` : input.code;
  if (!code) return null;
  const b = map.find((x) => x.code === code);
  return b ? { id: b.id, down: input.type === 'keyDown' } : null;
}

// What an input event does in a zone: { id, n (range: 1, 2, …), main, window } or null. groups: the groups that apply,
// the nearest first; always: only the bindings that work while a dialog is open.
function match(map: ReturnType<typeof keymap>, input: Typed, groups: Group[], { always = false } = {}) {
  if (input.type && input.type !== 'keyDown') return null;
  const key = keyOf(input);
  for (const g of groups) {
    for (const b of map) {
      if (b.group !== g || b.display || (always && !b.always)) continue;
      const c = b.chords.find(({ k }) => k.key === key && k.control === !!input.control && k.alt === !!input.alt
        && k.shift === !!input.shift && k.meta === !!input.meta);
      if (c) return { id: b.id, n: b.range ? c.i + 1 : undefined, main: !!b.main, window: !!b.window };
    }
  }
  return null;
}

// A key as the OS shows it: Ctrl+Shift+T; ⇧⌘T on macOS.
const MAC: Record<string, string> = { control: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' };
const NAMES: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓', pageup: 'PgUp', pagedown: 'PgDn', escape: 'Esc', tab: 'Tab', space: 'Space', enter: 'Enter' };
// A key's code as the OS names the key: Right Ctrl; Right ⌘ on macOS; Scroll Lock.
const MOD_NAMES: Record<string, string> = { Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Win' };
function codeName(code: string, platform = process.platform) {
  const m = MODIFIER.exec(code);
  if (m) return `${m[2]} ${platform === 'darwin' ? MAC[m[1]!.toLowerCase()] : m[1] === 'Meta' && platform !== 'win32' ? 'Super' : MOD_NAMES[m[1]!]}`;
  return code.replace(/([a-z])([A-Z\d])/g, '$1 $2');
}
function display(accelerator: string, platform = process.platform) {
  const k = parse(accelerator, platform)!;
  const key = NAMES[k.key] || (/^f\d+$/.test(k.key) ? k.key.toUpperCase() : k.key.length === 1 ? k.key.toUpperCase() : k.key);
  if (platform === 'darwin') return ['control', 'alt', 'shift', 'meta'].filter((m) => k[m as keyof Key]).map((m) => MAC[m]).join('') + key;
  return [k.control && 'Ctrl', k.alt && 'Alt', k.shift && 'Shift', k.meta && 'Win', key].filter(Boolean).join('+');
}

// The table for the window: each binding with a label, its keys as shown (a range as its first and last: Ctrl+1…8).
function list(platform = process.platform, custom: Record<string, string> = {}): Shortcut[] {
  return keymap(platform, custom).filter((b): b is typeof b & { label: string } => !!b.label).map((b) => {
    const shown = b.code ? [codeName(b.code, platform)] : keysOf(b, platform).shown.map((a) => display(a, platform));
    return { id: b.id, group: b.group, label: b.label, keys: b.range ? [`${shown[0]}…${shown.at(-1)!.slice(-1)}`] : shown, hold: b.hold };
  });
}

export type { Group, Key };
export { KEYS, keymap, match, held, holdable, parse, display, codeName, list };
