// One immutable task identity in its own page (docs/window.md).
import '../window.css';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@ui';
import { TaskScreen } from './TaskView';
import { PointMenu } from '../components/Menus';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { menuAtPoint } from '../lib/menu';
import { taskStore } from './state';
import { taskGrid } from './controller';
import { taskIdentity } from '../lib/store';
import type { TaskPresentation } from '../../shared/ipc';
import '../lib/names';
import '../lib/keys';
import '../lib/test-hooks';

thumbnailMenu(menuAtPoint);
const root = createRoot(document.getElementById('app')!, { onCaughtError: () => {} });
let initialized = false;
kulisa.on('task:initial', () => {
  if (initialized) return;
  initialized = true;
  root.render(<TooltipProvider><TaskScreen /><Thumbnail /><PointMenu /></TooltipProvider>);
  let previous = '';
  taskStore().subscribe((state) => {
    const presentation: TaskPresentation = { workbenchItem: state.workbenchItem, selectedArtifact: state.selectedArtifact,
      stagePosition: state.stagePosition, stageLayout: state.stageLayout, stageOverflow: state.stageOverflow, stageFollowPaused: state.stageFollowPaused };
    const text = JSON.stringify(presentation);
    if (text !== previous) { previous = text; kulisa.send('task:presentation', presentation); }
  });
});
kulisa.on('task:command', ({ command, profile }) => {
  if (command === 'profile:show' && profile) taskGrid(taskIdentity)?.stage.api?.getPanel(`profile:${profile}`)?.api.setActive();
  if (command === 'terminal:open') void import('./environments').then((m) => m.newStageTerminal(taskIdentity!));
});
kulisa.on('task:drain', async (sequence) => {
  taskGrid(taskIdentity)?.flush();
  await taskGrid(taskIdentity)?.development.drainEditor();
  await kulisa.invoke('task:drained', sequence);
});
void kulisa.invoke('task:ready');
