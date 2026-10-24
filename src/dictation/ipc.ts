// The dictation's channels between a window's page and the main process (README), joined into all of them in
// src/shared/ipc.ts. Keyed by the task's key.

// What a task's microphone shows: none (disabled, why), ready, recording.
export type Voice = { state: 'none'; why: string } | { state: 'ready' | 'recording' };

// ipcRenderer.invoke / ipcMain.handle (args, the answer).
export interface DictationInvoke {
  'voice:get': { args: [task: string]; result: Voice };
  'voice:record': { args: [{ task: string; on: boolean }]; result: Voice };
}

// webContents.send / the window's kulisa.on: what the main process tells a window.
export interface DictationEvents {
  'voice': { task: string; voice: Voice };
}
