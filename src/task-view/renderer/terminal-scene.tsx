// Application terminal scene adapters; agent terminals use their own Workbench surface (../README.md).
import { PlusIcon, TerminalSquareIcon } from 'lucide-react';
import { Button } from '@ui';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { useTask } from './state';
import { newStageTerminal } from './stage-terminal-focus';
import type { LauncherMode, StageScene } from './scene-contract';

function TerminalLaunchers({ mode }: { mode: LauncherMode }) {
  const task = useTask((s) => s.key);
  return mode === 'tile'
    ? <Button variant="outline" className="h-auto w-60 justify-start" onClick={() => void newStageTerminal(task)}><PlusIcon />Stage Terminal</Button>
    : <Button variant="ghost" size="sm" onClick={() => void newStageTerminal(task)} aria-label="Stage Terminal"><TerminalSquareIcon />Stage Terminal</Button>;
}
export const terminalScene: StageScene = {
  kind: 'terminal', component: 'stage-terminal', pane: StageTerminalPane, header: StageTerminalHeader,
  panels: (state) => state.stageTerminals.map((terminal) => ({ id: `stage-terminal:${terminal.id}`, title: terminal.name })),
  launcherOrder: 0, Launchers: TerminalLaunchers,
  command: (event, state) => {
    if (event.command !== 'terminal:open') return false;
    void newStageTerminal(state.key); return true;
  },
};
