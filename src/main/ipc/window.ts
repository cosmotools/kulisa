// The window's own settings and what is drawn over it (docs/window.md): the Kulisa zoom, theme, the bar's place,
// language; the pages hidden under HTML, a question's answer.
import { stepZoom } from '../profiles.ts';
import { handle, on } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';

export function registerWindow(ipc: Ipc) {
  const { shell, at } = ipc;
  handle('zoom:get', () => shell.uiZoom);
  handle('language:get', () => shell.languageInfo());
  handle('language:set', (_e, code) => shell.setLanguage(code));
  handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  handle('bar:set', (_e, bar) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  handle('views:hidden', (e, hidden, opts?) => at(e)?.hideViews(hidden, opts));
  on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer));
}
