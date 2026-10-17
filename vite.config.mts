// The window's UI (src/renderer: Vue components in TypeScript), built by Vite into dist/renderer, which the main
// process loads from disk (window.ts, master.ts): no dev server, as no page of the app may load from an HTTP server
// of its own (CLAUDE.md, Hard-won facts). Three pages: a tasks' window (index.html), Settings' window (settings.html) and
// a master's window (master.html).
//   npm run build   type checks (vue-tsc), then builds; npm start and npm test build first
//   npm run watch   builds again on every change (then reload the window: Ctrl+R in its DevTools, or restart)
// Not Electron Forge's Vite plugin: it packages only what Vite built (.vite/), the main process included, and
// Kulisa's main process is not bundled (node-pty is native; playwright-core and the MCP SDK read their own files).
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

const renderer = resolve(import.meta.dirname, 'src/renderer');
export default defineConfig({
  root: renderer,
  base: './', // loaded from file://
  plugins: [vue()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Electron's Chromium: the code and the CSS as written (nesting, light-dark(), anchor positioning), not lowered.
    target: 'esnext',
    cssTarget: 'chrome150',
    chunkSizeWarningLimit: 2000, // xterm, dockview and Vue in one bundle, read from disk: no network to split it for
    sourcemap: true, // Kulisa's own DevTools, running from source; packaged builds leave them out (forge.config.ts)
    rolldownOptions: { input: { index: resolve(renderer, 'index.html'), master: resolve(renderer, 'master.html'), settings: resolve(renderer, 'settings.html') } },
  },
});
