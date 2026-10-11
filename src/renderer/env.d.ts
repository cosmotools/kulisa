// The window's bridge to the main process (src/preload/index.cts).
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface KulisaBridge {
  platform: string; // process.platform: 'linux', 'darwin', 'win32'
  nameChar(c: string): boolean; // a character names may have (main/names.ts)
  nameMax: number;
  repoName(url: string): string; // a folder's or repository URL's last part (main/names.ts)
  avatars: string[]; // the profiles' pictures to choose from (main/avatars.ts)
  nextAvatar(used: string[]): string;
  invoke<T = any>(channel: string, ...args: unknown[]): Promise<T>;
  send(channel: string, arg?: unknown): void;
  on<T = any>(channel: string, fn: (arg: T) => void): void;
}

declare const kulisa: KulisaBridge;
