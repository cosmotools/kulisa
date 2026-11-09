// Extraction check: bundle only the standalone host and the viewer's public entry.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { findPackageJSON } from 'node:module';

await build({ configFile: false, root: path.resolve(import.meta.dirname, '../examples/file-viewer'), base: './',
  plugins: [react(), { name: 'image-size-license', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'image-size-LICENSE.txt',
      source: readFileSync(path.resolve(path.dirname(findPackageJSON('image-size', import.meta.url)!), 'LICENSE'), 'utf8') });
  } }], build: { outDir: path.resolve(import.meta.dirname, '../dist/file-viewer-example'), emptyOutDir: true,
    target: 'esnext', chunkSizeWarningLimit: 2000 }, logLevel: 'warn' });
