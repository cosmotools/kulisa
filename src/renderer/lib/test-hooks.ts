// What the tests (test/*.js) reach in the window by name, as they did when its scripts were plain ones: the shown
// task's profiles and key, its actions, the terminal's copy and paste keys, its links and the window's hooks on them, the keys as shown. Others are set where
// they live (window.__dock, __term, __termRenderer, __ptySizes, __layoutPreset).
import { act, store } from './store';
import { clipboardKey, termHooks, termLinks } from '../../terminal/renderer';
import { keyText } from './common';

Object.assign(window, { act, clipboardKey, termLinks, termHooks, keyText });
Object.defineProperty(window, 'state', { get: () => store.profiles });
Object.defineProperty(window, 'tasks', { value: { get current() { return store.current; } } });
