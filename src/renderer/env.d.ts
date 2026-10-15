// The window's bridge to the main process (src/preload/index.cjs).
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// Its channels, what each takes and answers: src/shared/ipc.ts (docs/window.md, IPC).
interface KulisaBridge {
  platform: string; // process.platform: 'linux', 'darwin', 'win32'
  invoke<C extends keyof import('../shared/ipc.ts').Invoke>(channel: C, ...args: import('../shared/ipc.ts').Invoke[C]['args']): Promise<import('../shared/ipc.ts').Invoke[C]['result']>;
  send<C extends keyof import('../shared/ipc.ts').Send>(channel: C, arg: import('../shared/ipc.ts').Send[C]): void;
  on<C extends keyof import('../shared/ipc.ts').Events>(channel: C, fn: (arg: import('../shared/ipc.ts').Events[C]) => void): void;
}

declare const kulisa: KulisaBridge;
