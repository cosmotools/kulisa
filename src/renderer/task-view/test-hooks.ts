// What the tests (test/e2e) reach in one task page by name: its profiles and key, its actions, the terminal's
// copy and paste keys, its links, the keys as shown, dockview's API and arrangements, the terminal shown.
import { store } from '../lib/store';
import { act, taskStore } from './state';
import { dockApi, stageApi } from './controller';
import { panelView, shownTerm } from './terminals';
import { clipboardKey, termLinks } from '../../terminal/renderer';
import { keyText } from '../lib/common';

Object.assign(window, { act, clipboardKey, termLinks, keyText });
Object.defineProperty(window, 'state', { get: () => taskStore().getState().profiles });
Object.defineProperty(window, 'tasks', { value: { get current() { return store.getState().current; } } });
Object.defineProperty(window, '__dock', { get: dockApi });
Object.defineProperty(window, '__stage', { get: stageApi });
Object.defineProperty(window, '__term', { get: shownTerm });
Object.defineProperty(window, '__termRenderer', { get: () => shownTerm() && panelView.renderer });
