// The window's UI (src/renderer: React components on shadcn/ui, src/ui, in TypeScript; Tailwind), built by Vite into dist/renderer, which the main
// process loads from disk (window.ts, master.ts): no dev server, as no page of the app may load from an HTTP server
// of its own (CLAUDE.md, Hard-won facts). Three pages: a tasks' window (index.html), a master's window (master.html) and
// a screenshot's thumbnail (thumbnail.html: only loading src/screenshots/renderer/thumbnail.ts; a page outside the root
// is refused).
//   npm run build   type checks (tsc), then builds; npm start and npm test build first
//   npm run watch   builds again on every change (then reload the window: Ctrl+R in its DevTools, or restart)
// Not Electron Forge's Vite plugin: it packages only what Vite built (.vite/), the main process included, and
// Kulisa's main process is not bundled (node-pty is native; playwright-core and the MCP SDK read their own files).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { findPackageJSON } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const renderer = resolve(import.meta.dirname, 'src/renderer');
const diffsRoot = resolve(dirname(fileURLToPath(import.meta.resolve('@pierre/diffs'))), '..');
export default defineConfig({
  root: renderer,
  base: './', // loaded from file://
  plugins: [react(), tailwindcss(), {
    name: 'review-licenses',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'welcome-photography-CREDITS.txt', source: readFileSync(resolve(renderer, 'components/welcome/assets/CREDITS.txt'), 'utf8') });
      this.emitFile({ type: 'asset', fileName: 'pierre-diffs-LICENSE.txt', source: readFileSync(resolve(diffsRoot, 'LICENSE.md'), 'utf8') });
      const imageSizeRoot = dirname(findPackageJSON('image-size', import.meta.url)!);
      this.emitFile({ type: 'asset', fileName: 'image-size-LICENSE.txt', source: readFileSync(resolve(imageSizeRoot, 'LICENSE'), 'utf8') });
      for (const name of ['react-query', 'query-core']) {
        const root = dirname(fileURLToPath(import.meta.resolve(`@tanstack/${name}/package.json`)));
        this.emitFile({ type: 'asset', fileName: `tanstack-${name}-LICENSE.txt`, source: readFileSync(resolve(root, 'LICENSE'), 'utf8') });
      }
      const trees = findPackageJSON('@pierre/trees', import.meta.url)!;
      for (const [name, files] of [
        ['@pierre/trees', ['LICENSE.md', 'NOTICE.md']], ['@pierre/theming', ['LICENSE.md']],
        ['preact', ['LICENSE']], ['preact-render-to-string', ['LICENSE']], ['lucide', ['LICENSE']],
      ] as const) {
        const root = dirname(findPackageJSON(name, pathToFileURL(trees))!);
        for (const file of files) this.emitFile({ type: 'asset', fileName: `${name.replace('@', '').replace('/', '-')}-${file.replace(/\.md$/, '.txt')}`, source: readFileSync(resolve(root, file), 'utf8') });
      }
    },
  }],
  resolve: { alias: { '@ui': resolve(import.meta.dirname, 'src/ui') } }, // src/ui's own imports (components.json, aliases)
  worker: { format: 'es' },
  build: {
    license: { fileName: 'third-party-licenses.md' },
    outDir: resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Electron's Chromium: the code and the CSS as written (nesting, light-dark(), anchor positioning), not lowered.
    target: 'esnext',
    cssTarget: 'chrome150',
    chunkSizeWarningLimit: 2000, // xterm, dockview, React and Radix in one bundle, read from disk: no network to split it for
    sourcemap: true, // Kulisa's own DevTools, running from source; packaged builds leave them out (forge.config.ts)
    rolldownOptions: { input: { index: resolve(renderer, 'index.html'), task: resolve(renderer, 'task.html'), master: resolve(renderer, 'master.html'), thumbnail: resolve(renderer, 'thumbnail.html') } },
  },
});
