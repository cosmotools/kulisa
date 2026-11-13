// Application terminal pane adapters; agent terminals use their own Workbench surface (../README.md).
import { PlusIcon, TerminalSquareIcon } from 'lucide-react';
import { Button } from '@ui';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { TerminalPanes } from './state';
import { terminalLauncher } from './launchers';
import type { TerminalPaneHost } from './state';
import type { LauncherMode, StagePaneKind } from '../../shared/stage-pane';

function TerminalLaunchers({ mode, pane }: { mode: LauncherMode; pane: TerminalPanes }) {
  const launcher = terminalLauncher(pane.open);
  return mode === 'tile'
    ? <Button variant="outline" className="h-auto w-60 justify-start" onClick={() => void launcher.run()}><PlusIcon />{launcher.label}</Button>
    : <Button variant="ghost" size="sm" onClick={() => void launcher.run()} aria-label={launcher.label}><TerminalSquareIcon />{launcher.label}</Button>;
}
export function createTerminalPane(host: TerminalPaneHost) {
  const terminal = new TerminalPanes(host);
  const definition: StagePaneKind = {
    kind: 'terminal', component: 'stage-terminal',
    pane: (props) => <StageTerminalPane pane={terminal} {...props} />,
    header: (props) => <StageTerminalHeader pane={terminal} {...props} />,
    panes: () => terminal.getState().stageTerminals.map((t) => ({ id: `stage-terminal:${t.id}`, title: t.name })),
    launcherOrder: 0,
    Launchers: (props) => <TerminalLaunchers pane={terminal} {...props} />,
    bind: terminal.bind,
    command: (event) => {
      if (event.command !== 'terminal:open') return false;
      void terminal.open(); return true;
    },
    reset: terminal.reset,
  };
  return definition;
}
