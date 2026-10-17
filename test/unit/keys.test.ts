// Kulisa's keyboard shortcuts (keys.ts): which key an input event is, on any layout and OS, and what it does where the
// keyboard is; the table itself kept free of clashes and of keys that are the agent's or the OS's.
import { test } from 'node:test';
import assert from 'assert/strict';
import { KEYS, keymap, match, held, holdable, display, codeName, list, parse } from '../../src/main/keys.ts';
import type { Group, Key } from '../../src/main/keys.ts';

// An input event as Electron's before-input-event gives it.
const key = (key: string, code: string, mods = '') => ({ type: 'keyDown', key, code, control: mods.includes('c'), shift: mods.includes('s'), alt: mods.includes('a'), meta: mods.includes('m') });
const linux = keymap('linux'), mac = keymap('darwin');
const id = (map: ReturnType<typeof keymap>, input: ReturnType<typeof key>, groups: Group[] = ['page', 'global']) => match(map, input, groups)?.id ?? null;

test('keys: a letter is what it types on a Latin layout, its place on another; digits and shifted keys by their place', () => {
  assert.equal(id(linux, key('t', 'KeyT', 'c')), 'tab.new');
  assert.equal(id(linux, key('е', 'KeyT', 'c')), 'tab.new', 'Ctrl+Е on a Russian layout is Ctrl+T');
  assert.equal(id(linux, key('w', 'KeyZ', 'c')), 'tab.close', 'the W of an AZERTY keyboard, where a QWERTY one has Z');
  assert.equal(id(linux, key('ё', 'Backquote', 'c'), ['global']), 'terminal.focus');
  assert.deepEqual(match(linux, key('!', 'Digit1', 'cs'), ['global']), { id: 'task.n', n: 1, main: false, window: false });
  assert.equal(match(linux, key('3', 'Digit3', 'c'), ['page']).n, 3);
  assert.equal(id(linux, key('?', 'Slash', 'cs'), ['global']), 'shortcuts');
  assert.equal(id(linux, key('T', 'KeyT', 'cs')), 'tab.reopen');
  assert.equal(id(linux, key('Tab', 'Tab', 'cs')), 'tab.previous');
  assert.equal(id(linux, key('ArrowLeft', 'ArrowLeft', 'a')), 'tab.back');
  assert.equal(id(linux, key('F5', 'F5')), 'tab.reload');
  assert.equal(id(linux, { ...key('t', 'KeyT', 'c'), type: 'keyUp' }), null);
});

test('keys: the zoom on every layout, as before (Ctrl + = on US, Ctrl + + on German, the numpad); a page\'s own first', () => {
  for (const k of [key('=', 'Equal', 'c'), key('+', 'Equal', 'cs'), key('+', 'BracketRight', 'c'), key('+', 'NumpadAdd', 'c')]) {
    assert.equal(id(linux, k, ['global']), 'zoom.in', JSON.stringify(k));
    assert.equal(id(linux, k, ['page', 'global']), 'site.zoomIn', `in a page: ${JSON.stringify(k)}`);
  }
  assert.equal(id(linux, key('-', 'Slash', 'c'), ['global']), 'zoom.out', 'Ctrl + - on German');
  assert.equal(id(linux, key('0', 'Digit0', 'c'), ['global']), 'zoom.reset');
  // A dialog keeps its keys, but the zoom works there as before.
  assert.equal(match(linux, key('t', 'KeyT', 'cs'), ['global'], { always: true }), null);
  assert.equal(match(linux, key('=', 'Equal', 'c'), ['global'], { always: true }).id, 'zoom.in');
});

test('keys: the terminal keeps the agent\'s keys: Kulisa takes only Ctrl+Shift+… and Ctrl+` there', () => {
  for (const [k, c] of [['t', 'KeyT'], ['r', 'KeyR'], ['w', 'KeyW'], ['l', 'KeyL'], ['c', 'KeyC'], ['1', 'Digit1']]) assert.equal(id(linux, key(k, c, 'c'), ['global']), null, `Ctrl+${k}`);
  for (const k of ['v', 'p', 't', 'm']) assert.equal(id(linux, key(k, `Key${k.toUpperCase()}`, 'a'), ['global']), null, `Alt+${k}: Claude Code's`);
  // Every global key has Ctrl and Shift, or is Ctrl+` or an F key: what agents and sites leave alone.
  for (const b of linux.filter((x) => x.group === 'global')) for (const { a, k } of b.chords) {
    assert.ok((k.control && k.shift) || (k.control && k.key === '`') || /^f\d+$/.test(k.key) || b.always, `${b.id}: ${a}`);
  }
});

test('keys: macOS: ⌘ for Kulisa\'s and Chrome\'s keys, Ctrl left to the terminal; macOS\'s own keys left alone', () => {
  assert.equal(id(mac, key('t', 'KeyT', 'm')), 'tab.new');
  assert.equal(id(mac, key('t', 'KeyT', 'c')), null);
  assert.equal(id(mac, key('[', 'BracketLeft', 'm')), 'tab.back');
  assert.equal(id(mac, key('Tab', 'Tab', 'c')), 'tab.next', 'Ctrl+Tab, as Chrome on macOS');
  assert.equal(match(mac, key('2', 'Digit2', 'ma'), ['global']).n, 2);
  assert.equal(id(mac, key('#', 'Digit3', 'ms'), ['global']), null, '⌘⇧3 is macOS\'s screenshot');
  assert.equal(parse('Command+L', 'linux'), null, 'Command exists on macOS only');
});

test('keys: no key does two things in one place, on any OS; no key without a modifier but F keys', () => {
  for (const platform of ['linux', 'win32', 'darwin'] as const) {
    const map = keymap(platform), seen = new Map<string, string>();
    for (const b of map) for (const { a, k } of b.chords) {
      const chord = `${b.group} ${['control', 'alt', 'shift', 'meta'].filter((m) => k[m as keyof Key]).join('+')} ${k.key}`;
      assert.ok(!seen.has(chord), `${platform}: ${a} is ${seen.get(chord)} and ${b.id}`);
      seen.set(chord, b.id);
      assert.ok(k.control || k.alt || k.meta || /^f\d+$/.test(k.key), `${platform}: ${b.id} ${a} needs a modifier (WCAG 2.1.4)`);
      assert.ok(!(k.control && k.shift && ['u', 'e'].includes(k.key)), `${platform}: ${a} is ibus's (Unicode, emoji)`);
    }
  }
  assert.equal(new Set(KEYS.map((b) => b.id)).size, KEYS.length);
});

test('keys: shown as the OS shows them; a range as its first and last', () => {
  assert.equal(display('CommandOrControl+Shift+T', 'linux'), 'Ctrl+Shift+T');
  assert.equal(display('CommandOrControl+Shift+T', 'darwin'), '⇧⌘T');
  assert.equal(display('Alt+Left', 'win32'), 'Alt+←');
  assert.equal(display('Control+`', 'linux'), 'Ctrl+`');
  const shown = Object.fromEntries(list('linux').map((s) => [s.id, s.keys]));
  assert.deepEqual(shown['tab.n'], ['Ctrl+1…8']);
  assert.deepEqual(shown['task.n'], ['Ctrl+Shift+1…9']);
  assert.deepEqual(shown['tab.address'], ['Ctrl+L', 'Alt+D', 'F6']);
  assert.deepEqual(shown['terminal.copy'], ['Ctrl+Shift+C']);
  assert.deepEqual(Object.fromEntries(list('win32').map((s) => [s.id, s.keys]))['terminal.copy'], ['Ctrl+C']);
  assert.equal(shown['devtools.app'], undefined, 'Kulisa\'s own DevTools are not listed');
});

test('keys: a key held alone (the dictation\'s): the right Ctrl, ⌘ on macOS, its press and its release by its code, not its repeats', () => {
  const ctrl = (type: string, code = 'ControlRight', isAutoRepeat = false) => ({ type, key: 'Control', code, control: true, isAutoRepeat });
  assert.deepEqual(held(linux, ctrl('keyDown')), { id: 'voice.hold', down: true });
  assert.deepEqual(held(linux, ctrl('keyUp')), { id: 'voice.hold', down: false });
  assert.equal(held(linux, ctrl('keyDown', 'ControlRight', true)), null, 'a repeat while held is no press');
  assert.equal(held(linux, ctrl('keyDown', 'ControlLeft')), null, 'the left one is the usual Ctrl');
  assert.deepEqual(held(linux, { ...ctrl('keyDown', 'ControlLeft'), location: 2 }), { id: 'voice.hold', down: true }, 'by its side when the code has none (a sent event)');
  assert.equal(held(linux, { ...ctrl('keyDown'), type: 'rawKeyDown' }), null);
  assert.equal(match(linux, ctrl('keyDown'), ['global']), null, 'not a chord');
  assert.equal(held(mac, ctrl('keyDown')), null);
  assert.deepEqual(held(mac, { type: 'keyDown', key: 'Meta', code: 'MetaRight', meta: true }), { id: 'voice.hold', down: true });
  // The human's own key instead (settings.json, keys): one that types nothing and is no key of Kulisa's.
  const own = keymap('linux', { 'voice.hold': 'F9' });
  assert.deepEqual(held(own, { type: 'keyDown', key: 'F9', code: 'F9' }), { id: 'voice.hold', down: true });
  assert.equal(held(own, ctrl('keyDown')), null);
  assert.equal(holdable(linux, 'F9'), null);
  assert.equal(holdable(linux, 'ShiftRight'), null);
  assert.match(holdable(linux, 'KeyA'), /^Press a key that types nothing/);
  assert.match(holdable(linux, 'Space'), /^Press a key that types nothing/);
  assert.match(holdable(linux, 'CapsLock'), /^Press a key that types nothing/, 'the OS toggles it');
  assert.equal(holdable(linux, 'F5'), 'F5 is already Reload');
  assert.equal(holdable(linux, 'F12'), 'F12 is already DevTools of the tab');
  // Shown as the OS names the key.
  assert.equal(codeName('ControlRight', 'linux'), 'Right Ctrl');
  assert.equal(codeName('MetaRight', 'darwin'), 'Right ⌘');
  assert.equal(codeName('MetaRight', 'win32'), 'Right Win');
  assert.equal(codeName('ScrollLock', 'linux'), 'Scroll Lock');
  const shown = (platform: 'linux' | 'darwin', custom = {}) => list(platform, custom).find((s) => s.id === 'voice.hold');
  assert.deepEqual(shown('linux'), { id: 'voice.hold', group: 'global', label: 'Speak to the agent: hold, or press once and again', keys: ['Right Ctrl'], hold: true });
  assert.deepEqual(shown('darwin').keys, ['Right ⌘']);
  assert.deepEqual(shown('linux', { 'voice.hold': 'F9' }).keys, ['F9']);
});
