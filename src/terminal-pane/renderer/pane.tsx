// Application terminal pane adapters; agent terminals use their own Workbench surface (../README.md).
import { PlusIcon, TerminalSquareIcon } from 'lucide-react';
import { Button } from '@ui';
import { StageTerminalPane, StageTerminalHeader } from './StageTerminalPane';
import { TerminalPanes, TerminalPaneContext, useTerminalPane } from './state';
import type { TerminalPaneHost } from './state';
import type { LauncherMode, StagePaneKind } from '../../shared/stage-pane';

function TerminalLaunchers({ mode }: { mode: LauncherMode }) {
  const pane = useTerminalPane();
  return mode === 'tile'
    ? <Button variant="outline" className="h-auto w-60 justify-start" onClick={() => void pane.open()}><PlusIcon />Stage Terminal</Button>
    : <Button variant="ghost" size="sm" onClick={() => void pane.open()} aria-label="Stage Terminal"><TerminalSquareIcon />Stage Terminal</Button>;
}
export function createTerminalPane(host: TerminalPaneHost) {
  const terminal = new TerminalPanes(host);
  const definition: StagePaneKind = {
    kind: 'terminal', component: 'stage-terminal',
    pane: (props) => <TerminalPaneContext.Provider value={terminal}><StageTerminalPane {...props} /></TerminalPaneContext.Provider>,
    header: (props) => <TerminalPaneContext.Provider value={terminal}><StageTerminalHeader {...props} /></TerminalPaneContext.Provider>,
    panes: () => terminal.getState().stageTerminals.map((t) => ({ id: `stage-terminal:${t.id}`, title: t.name })),
    launcherOrder: 0,
    Launchers: (props) => <TerminalPaneContext.Provider value={terminal}><TerminalLaunchers {...props} /></TerminalPaneContext.Provider>,
    bind: terminal.bind,
    command: (event) => {
      if (event.command !== 'terminal:open') return false;
      void terminal.open(); return true;
    },
    reset: terminal.reset,
  };
  return definition;
}
