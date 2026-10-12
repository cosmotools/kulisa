// The window's bridge to the main process (src/preload/index.cjs).
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface KulisaBridge {
  platform: string; // process.platform: 'linux', 'darwin', 'win32'
  invoke<T = any>(channel: string, ...args: unknown[]): Promise<T>;
  send(channel: string, arg?: unknown): void;
  on<T = any>(channel: string, fn: (arg: T) => void): void;
}

declare const kulisa: KulisaBridge;
