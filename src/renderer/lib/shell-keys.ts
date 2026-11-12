// Window commands stay in the healthy shell, independent of task JavaScript (docs/window.md).
import '../../layers/renderer';
import { store } from './store';
import { dialog } from './dialogs';
import { toggleSidebar } from './sidebar';
import { closeLayers } from '../../layers/renderer';
kulisa.on('command:run', ({ id }) => {
  if (id === 'task.menu') toggleSidebar();
  if (id === 'shortcuts') void dialog('shortcuts').then((d) => d.showShortcuts());
});
store.subscribe((next, previous) => { if (next.current !== previous.current) void closeLayers('menus'); });
