// The terminal's channels between a window's page and the main process, joined into all of them in src/shared/ipc.ts.
// Keyed by the terminal's key ("<task key>#<id>", or a sign-in's).

// Shared read limit for callers retaining a headless terminal screen.
export const TERMINAL_LINES = 500;

// The terminals' contents a window sends when a task moves, by key, to the window it goes to.
export type TerminalContents = Record<string, { data: string; cols: number; rows: number }>;

// A path a terminal names that exists (README, Links): as the window found it, and whether opening it would run it.
export interface FileLink { path: string; executable: boolean }

// ipcRenderer.send / ipcMain.on: what is sent, no answer.
export interface TerminalSend {
  'pty:in': { task: string; data: string };
  'pty:resize': { task: string; cols: number; rows: number };
}

// webContents.send / the window's kulisa.on: what the main process tells a window.
export interface TerminalEvents {
  'terminals:restore': TerminalContents;
  'terminals:gone': string[];
  'pty:out': { task: string; data: string; cols: number; rows: number };
}

export interface TerminalInvoke {
  'pty:quote-paths': { args: [{ task: string; paths: string[] }]; result: string | null };
}

// Named keys for programmatic input; modes are applied by the terminal runtime.
export const terminalKeys: Record<string, string> = {
  Enter: '\r', Escape: '\x1b', Tab: '\t', 'Shift+Tab': '\x1b[Z', Backspace: '\x7f',
  ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D',
  Home: '\x1b[H', End: '\x1b[F', Insert: '\x1b[2~', Delete: '\x1b[3~', PageUp: '\x1b[5~', PageDown: '\x1b[6~',
  F1: '\x1bOP', F2: '\x1bOQ', F3: '\x1bOR', F4: '\x1bOS', F5: '\x1b[15~', F6: '\x1b[17~',
  F7: '\x1b[18~', F8: '\x1b[19~', F9: '\x1b[20~', F10: '\x1b[21~', F11: '\x1b[23~', F12: '\x1b[24~',
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`Ctrl+${String.fromCharCode(65 + i)}`, String.fromCharCode(i + 1)])),
};
export type TerminalKey = string;
