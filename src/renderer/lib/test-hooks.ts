// What the tests (test/e2e) reach in the window by name: the shown task's profiles and key, its actions, the terminal's
// copy and paste keys, its links, the keys as shown, dockview's API and arrangements, the terminal shown.
import { act, store } from './store';
import { clipboardKey, termLinks } from '../../terminal/renderer';
import { keyText } from './common';
import { dockApi, stageApi } from './grid';
import { panelView, shownTerm } from './terminals';

Object.assign(window, { act, clipboardKey, termLinks, keyText });
Object.defineProperty(window, 'state', { get: () => store.getState().profiles });
Object.defineProperty(window, 'tasks', { value: { get current() { return store.getState().current; } } });
Object.defineProperty(window, '__dock', { get: dockApi });
Object.defineProperty(window, '__stage', { get: stageApi });
Object.defineProperty(window, '__term', { get: shownTerm });
Object.defineProperty(window, '__termRenderer', { get: () => shownTerm() && panelView.renderer });
