// The windows' preload (window.ts, master.ts): what the window's page may call of the main process. Plain JavaScript,
// the one file that is not TypeScript: the windows are sandboxed, and Electron runs a sandboxed preload
// without Node, so no type stripping, and `require` gives only `electron` (Electron's tutorial/sandbox.md). Its types
// are the window's: src/renderer/env.d.ts.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kulisa', {
  platform: process.platform, // ☰ has Exit where the OS has no menu bar with Quit (components/TopBar.tsx)
  invoke: (ch, ...args) => ipcRenderer.invoke(ch, ...args),
  send: (ch, arg) => ipcRenderer.send(ch, arg),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, arg) => fn(arg)),
});
