// What the tests (test/*.js) reach in the window by name, as they did when its scripts were plain ones: the shown
// task's profiles and key, its actions, the terminal's copy and paste keys, its links, the keys as shown. Others are set
// where they live (window.__dock, __term, __termRenderer, __layoutPreset).
import { act, store } from './store';
import { clipboardKey, termLinks } from '../../terminal/renderer';
import { keyText } from './common';

Object.assign(window, { act, clipboardKey, termLinks, keyText });
Object.defineProperty(window, 'state', { get: () => store.getState().profiles });
Object.defineProperty(window, 'tasks', { value: { get current() { return store.getState().current; } } });
