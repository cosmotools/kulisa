// One immutable task identity in its own page (docs/window.md).
import '../../appearance/renderer/page.css';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@ui';
import { TaskScreen } from '.';
import { PointMenu, menuAtPoint } from '../../menus/renderer';
import { Thumbnail, thumbnailMenu } from '../../screenshots/renderer';
import { store, taskIdentity } from './state';
import { taskGrid } from './controller';
import './keys';
import './test-hooks';

thumbnailMenu(menuAtPoint);
const root = createRoot(document.getElementById('app')!, { onCaughtError: () => {} });
let initialized = false;
kulisa.on('task:initial', () => {
  if (initialized) return;
  initialized = true;
  root.render(<TooltipProvider><TaskScreen /><Thumbnail /><PointMenu /></TooltipProvider>);
  store.subscribe(({ workbenchItem, selectedArtifact, stagePosition, stageLayout, stageOverflow, stageFollowPaused }, previous) => {
    if (workbenchItem === previous.workbenchItem && selectedArtifact === previous.selectedArtifact
      && stagePosition === previous.stagePosition && stageLayout === previous.stageLayout
      && stageOverflow === previous.stageOverflow && stageFollowPaused === previous.stageFollowPaused) return;
    kulisa.send('task:presentation', { workbenchItem, selectedArtifact, stagePosition, stageLayout, stageOverflow, stageFollowPaused });
  });
});
kulisa.on('task:command', ({ command, profile }) => {
  if (command === 'profile:show' && profile) taskGrid(taskIdentity)?.stage.api?.getPanel(`profile:${profile}`)?.api.setActive();
  if (command === 'terminal:open') void import('./environments').then((m) => m.newStageTerminal(taskIdentity));
});
kulisa.on('task:drain', async (sequence) => {
  taskGrid(taskIdentity)?.flush();
  await taskGrid(taskIdentity)?.development.drainEditor();
  await kulisa.invoke('task:drained', sequence);
});
void kulisa.invoke('task:ready');
