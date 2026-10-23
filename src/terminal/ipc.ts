// The terminal's channels between a window's page and the main process, joined into all of them in src/shared/ipc.ts.
// Keyed by the terminal's key ("<task key>#<id>", or a sign-in's).

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
  'pty:out': { task: string; data: string };
}
