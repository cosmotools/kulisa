// The windows' preload (window.ts, master.ts): what the window's page may call of the main process. CommonJS, as
// Electron runs a preload that is not .mjs; the main process's modules are required as they are (ES modules, .ts).
const { contextBridge, ipcRenderer }: typeof import('electron') = require('electron');
const { nameChar, repoName, MAX }: typeof import('../main/names.ts') = require('../main/names.ts');
const { AVATARS, nextAvatar }: typeof import('../main/avatars.ts') = require('../main/avatars.ts');
contextBridge.exposeInMainWorld('kulisa', {
  platform: process.platform, // ☰ has Exit where the OS has no menu bar with Quit (TopBar.vue)
  nameChar, nameMax: MAX, // the characters names may have (names.ts), for the name fields (lib/names.ts)
  repoName, // a folder's or repository URL's name: a new project's until the human gives one (ProjectEditor.vue)
  avatars: AVATARS, nextAvatar, // the profiles' pictures to choose from, the one a new profile gets (avatars.ts)
  invoke: (ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args),
  send: (ch: string, arg?: unknown) => ipcRenderer.send(ch, arg),
  on: (ch: string, fn: (arg: unknown) => void) => ipcRenderer.on(ch, (_e, arg) => fn(arg)),
});
