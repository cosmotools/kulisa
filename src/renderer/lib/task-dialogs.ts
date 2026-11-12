// Task controls request window-modal dialogs from their current native owner (docs/window.md).
import type { StageTerminal } from '../../shared/stage-terminal';
import type { DevelopmentTerminalInfo } from '../../shared/types';
import { taskIdentity } from './store';

interface Dialogs {
  stageTerminalSettings: { open(terminal: StageTerminal): Promise<void> };
  handover: { open(terminal: DevelopmentTerminalInfo): Promise<void> };
}
export function dialog<N extends keyof Dialogs>(name: N): Promise<Dialogs[N]> {
  if (name === 'stageTerminalSettings') return Promise.resolve({ open: (terminal: StageTerminal) =>
    kulisa.invoke('shell:dialog', { kind: name, task: taskIdentity!, terminal }) } as Dialogs[N]);
  return Promise.resolve({ open: (terminal: DevelopmentTerminalInfo) =>
    kulisa.invoke('shell:dialog', { kind: 'handover', task: taskIdentity!, terminal }) } as Dialogs[N]);
}
