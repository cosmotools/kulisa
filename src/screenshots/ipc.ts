// The screenshots' channels (README, The thumbnail), joined into all of them in src/shared/ipc.ts: its thumbnail's page
// and the main process; the window's page and the main process (the window's drawing of it and its menu).

// What its menu's rows do (main/thumbnail.ts, act); resume: the menu closed, its time goes on.
export type ThumbnailAction = 'show' | 'copy' | 'send' | 'delete' | 'close' | 'resume';

// ipcRenderer.send / ipcMain.on: what the thumbnail's page says, no answer.
export interface ThumbnailSend {
  'thumbnail:open': void; // a click: the file in the OS's app for it
  'thumbnail:drag': void; // a drag started: the file dragged out
  'thumbnail:menu': { x: number; y: number }; // a right-click, where in its page
  'thumbnail:hover': boolean; // the pointer over it, or gone
}

// ipcRenderer.invoke / ipcMain.handle (args, the answer): the window's menu of it.
export interface ThumbnailInvoke {
  'thumbnail:act': { args: [{ action: ThumbnailAction }]; result: void };
}

// webContents.send / kulisa.on: the picture its page shows; to the window, where it is (CSS pixels; null: gone) and
// where its menu opens.
export interface ThumbnailEvents {
  'thumbnail:image': string; // a data: URL
  'thumbnail:place': { src: string; x: number; y: number; width: number; height: number } | null;
  'thumbnail:open-menu': { x: number; y: number };
}
