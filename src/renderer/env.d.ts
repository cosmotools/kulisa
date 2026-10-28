// What the window's pages have globally: the bridge to the main process (src/preload/index.cjs), the theme's script.

// Its channels, what each takes and answers: src/shared/ipc.ts (docs/window.md, IPC).
interface KulisaBridge {
  platform: string; // process.platform: 'linux', 'darwin', 'win32'
  invoke<C extends keyof import('../shared/ipc.ts').Invoke>(channel: C, ...args: import('../shared/ipc.ts').Invoke[C]['args']): Promise<import('../shared/ipc.ts').Invoke[C]['result']>;
  send<C extends keyof import('../shared/ipc.ts').Send>(channel: C, ...arg: import('../shared/ipc.ts').Arg<import('../shared/ipc.ts').Send[C]>): void;
  on<C extends keyof import('../shared/ipc.ts').Events>(channel: C, fn: (arg: import('../shared/ipc.ts').Events[C]) => void): void;
}

declare const kulisa: KulisaBridge;

// The theme put on the page's root (public/theme.js, lib/theme.ts).
declare function showTheme(theme: string): void;
