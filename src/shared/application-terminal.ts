// Application terminal configuration and bounded input, shared by its two handles.
export const TERMINAL_LINES = 500;
export interface TerminalSize { cols: number; rows: number }
export interface ApplicationConfig {
  id: number; name: string; command: string; size: TerminalSize | null;
}
export interface ApplicationTerminal extends ApplicationConfig {
  key: string; status: 'stopped' | 'starting' | 'running' | 'exited'; exitCode: number | null;
}
export interface ApplicationTerminals { task: string; list: ApplicationTerminal[] }
export type { TerminalKey as ApplicationKey } from '../terminal/ipc.ts';
export const validTerminalSize = (s: TerminalSize) => Number.isInteger(s.cols) && Number.isInteger(s.rows) && s.cols >= 2 && s.cols <= 500 && s.rows >= 2 && s.rows <= 200;

export interface ApplicationScreen {
  terminal: ApplicationTerminal; text: string;
  size: TerminalSize | null; cursor: { column: number; row: number } | null;
}
