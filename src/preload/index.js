const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kulisa', {
  invoke: (ch, ...args) => ipcRenderer.invoke(ch, ...args),
  send: (ch, arg) => ipcRenderer.send(ch, arg),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, arg) => fn(arg)),
});
