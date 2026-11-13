// Terminal-pane facts and cancellable human focus intent (../README.md).
import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import type { StageTerminal } from '../../shared/stage-terminal';
import type { PaneControls, PaneFacts } from '../../shared/stage-pane';
import type { actionsFor } from '../../window-client/renderer';
import { refused, type Result } from '../../shared/result';

export interface TerminalPaneFacts {
  active: boolean;
  covered: boolean;
  stageTerminals: StageTerminal[];
  stageActivity: string | null;
}
export interface TerminalPaneHost {
  task: string;
  facts: PaneFacts<TerminalPaneFacts>;
  act: ReturnType<typeof actionsFor>;
  controls: PaneControls;
  hasAgent(): boolean;
}
interface Focus { key: string | null }
export class TerminalPanes {
  readonly ui = createStore<{ focus: Focus | null }>()(() => ({ focus: null }));
  constructor(readonly host: TerminalPaneHost) {}
  getState = () => this.host.facts.getState();
  currentTask = () => this.getState().active ? this.host.task : null;
  reset = () => { if (this.ui.getState().focus) this.ui.setState({ focus: null }); };
  bind = () => {
    // The next human input wins over a launch still waiting for its shell or font.
    document.addEventListener('pointerdown', this.reset, true);
    document.addEventListener('keydown', this.reset, true);
    window.addEventListener('blur', this.reset);
  };
  focus = async (launch: () => Promise<Result<StageTerminal>>) => {
    const request = { key: null };
    this.ui.setState({ focus: request });
    try {
      const result = await launch();
      if (this.ui.getState().focus === request) this.ui.setState({ focus: refused(result) || !this.getState().active ? null : { key: result.key } });
      return result;
    } catch (error) {
      if (this.ui.getState().focus === request) this.reset();
      throw error;
    }
  };
  open = () => this.focus(() => this.host.act('stage-terminal:open', {}));
}
export const TerminalPaneContext = createContext<TerminalPanes | null>(null);
export function useTerminalPane() {
  const pane = useContext(TerminalPaneContext);
  if (!pane) throw new Error('Terminal pane host missing');
  return pane;
}
export function useFacts<T>(selector: (state: TerminalPaneFacts) => T) { return useStore(useTerminalPane().host.facts, selector); }
export function useFocus() { return useStore(useTerminalPane().ui, (s) => s.focus); }
export const usePaneActive = (enabled = true) => useFacts((s) => enabled && s.active && !s.covered);
