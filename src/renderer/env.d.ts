// The window's bridge to the main process (src/preload/index.js).
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface KulisaBridge {
  platform: string; // process.platform: 'linux', 'darwin', 'win32'
  nameChar(c: string): boolean; // a character names may have (main/names.js)
  nameMax: number;
  repoName(url: string): string; // a folder's or repository URL's last part (main/names.js)
  avatars: string[]; // the profiles' pictures to choose from (main/avatars.js)
  nextAvatar(used: string[]): string;
  invoke<T = any>(channel: string, ...args: unknown[]): Promise<T>;
  send(channel: string, arg?: unknown): void;
  on<T = any>(channel: string, fn: (arg: T) => void): void;
}

declare const kulisa: KulisaBridge;
