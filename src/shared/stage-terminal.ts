// Stage terminal configuration and bounded input, shared by its two handles.
export const TERMINAL_LINES = 500;
export interface TerminalSize { cols: number; rows: number }
export interface StageTerminalConfig {
  id: number; name: string; command: string; size: TerminalSize | null;
}
export interface StageTerminal extends StageTerminalConfig {
  key: string; status: 'stopped' | 'starting' | 'running' | 'exited'; exitCode: number | null; session: 'shell' | 'app' | null; launchError?: string;
}
export interface StageTerminalsState { task: string; list: StageTerminal[] }
export type { TerminalKey as StageTerminalKey } from '../terminal/ipc.ts';
export const validTerminalSize = (s: TerminalSize) => Number.isInteger(s.cols) && Number.isInteger(s.rows) && s.cols >= 2 && s.cols <= 500 && s.rows >= 2 && s.rows <= 200;

export interface StageTerminalScreen {
  terminal: StageTerminal; text: string;
  size: TerminalSize | null; cursor: { column: number; row: number } | null;
}
