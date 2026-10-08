const { contextBridge, ipcRenderer } = require('electron');
const { nameChar, MAX } = require('../main/names');
const { AVATARS, nextAvatar } = require('../main/avatars');
contextBridge.exposeInMainWorld('kulisa', {
  platform: process.platform, // ☰ has Exit where the OS has no menu bar with Quit (renderer.js)
  nameChar, nameMax: MAX, // the characters names may have (names.js), for the name fields (common.js)
  avatars: AVATARS, nextAvatar, // the profiles' pictures to choose from, the one a new profile gets (avatars.js)
  invoke: (ch, ...args) => ipcRenderer.invoke(ch, ...args),
  send: (ch, arg) => ipcRenderer.send(ch, arg),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, arg) => fn(arg)),
});
