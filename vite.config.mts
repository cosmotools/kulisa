// The window's UI (src/renderer: React components on shadcn/ui, src/ui, in TypeScript; Tailwind), built by Vite into dist/renderer, which the main
// process loads from disk (window.ts, master.ts): no dev server, as no page of the app may load from an HTTP server
// of its own (CLAUDE.md, Hard-won facts). Three pages: a tasks' window (index.html), a master's window (master.html) and
// a screenshot's thumbnail (thumbnail.html: only loading src/screenshots/renderer/thumbnail.ts; a page outside the root
// is refused).
//   npm run build   type checks (tsc), then builds; npm start and npm test build first
//   npm run watch   builds again on every change (then reload the window: Ctrl+R in its DevTools, or restart)
// Not Electron Forge's Vite plugin: it packages only what Vite built (.vite/), the main process included, and
// Kulisa's main process is not bundled (node-pty is native; playwright-core and the MCP SDK read their own files).
import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateManifest, type Manifest } from 'material-icon-theme';

// Only associations and asset URLs reach the window; SVG contents and the generator stay out of its JavaScript.
function fileIcons(): Plugin {
  const module = 'virtual:project-file-icons';
  const root = dirname(fileURLToPath(import.meta.resolve('material-icon-theme/package.json')));
  return {
    name: 'project-file-icons',
    resolveId(id) { if (id === module) return `\0${module}`; },
    load(id) {
      if (id !== `\0${module}`) return;
      const source = generateManifest({ activeIconPack: '' });
      const lower = (map?: Record<string, string>) => Object.fromEntries(Object.entries(map ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
      const associations = ({ file, fileNames, fileExtensions }: Manifest) =>
        ({ file, fileNames: lower(fileNames), fileExtensions: lower(fileExtensions) });
      const base = associations(source), light = associations(source.light ?? {});
      const manifest = { ...base, light };
      const referenced = new Set([base, light].flatMap((theme) => Object.values(theme)
        .flatMap((value) => typeof value === 'string' ? [value] : Object.values(value ?? {}))));
      const imports: string[] = [], urls: string[] = [];
      for (const [index, icon] of [...referenced].entries()) {
        const path = normalizePath(resolve(root, 'dist', source.iconDefinitions![icon]!.iconPath));
        imports.push(`import icon${index} from ${JSON.stringify(`${path}?no-inline`)};`);
        urls.push(`${JSON.stringify(icon)}: icon${index}`);
      }
      this.emitFile({ type: 'asset', fileName: 'material-icon-theme-LICENSE.txt', source: readFileSync(resolve(root, 'LICENSE'), 'utf8') });
      return `${imports.join('\n')}\nexport const icons = {${urls.join(',')}};\nexport const manifest = ${JSON.stringify(manifest)};`;
    },
  };
}

const renderer = resolve(import.meta.dirname, 'src/renderer');
const diffsRoot = resolve(dirname(fileURLToPath(import.meta.resolve('@pierre/diffs'))), '..');
export default defineConfig({
  root: renderer,
  base: './', // loaded from file://
  plugins: [react(), tailwindcss(), fileIcons(), {
    name: 'review-licenses',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'pierre-diffs-LICENSE.txt', source: readFileSync(resolve(diffsRoot, 'LICENSE.md'), 'utf8') });
    },
  }],
  resolve: { alias: { '@ui': resolve(import.meta.dirname, 'src/ui') } }, // src/ui's own imports (components.json, aliases)
  worker: { format: 'es' },
  build: {
    outDir: resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Electron's Chromium: the code and the CSS as written (nesting, light-dark(), anchor positioning), not lowered.
    target: 'esnext',
    cssTarget: 'chrome150',
    chunkSizeWarningLimit: 2000, // xterm, dockview, React and Radix in one bundle, read from disk: no network to split it for
    sourcemap: true, // Kulisa's own DevTools, running from source; packaged builds leave them out (forge.config.ts)
    rolldownOptions: { input: { index: resolve(renderer, 'index.html'), master: resolve(renderer, 'master.html'), thumbnail: resolve(renderer, 'thumbnail.html') } },
  },
});
