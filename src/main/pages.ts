// Kulisa's own pages (the window, a master's window): built from src/renderer by Vite into dist/renderer (vite.config.mts;
// npm start and npm test build them first, Forge before packaging).
import path from 'path';
import fs from 'fs';

const DIST = path.join(import.meta.dirname, '..', '..', 'dist', 'renderer');
function page(file: string) {
  const f = path.join(DIST, file);
  if (!fs.existsSync(f)) console.error(`[kulisa] ${f} is missing: build the window first (npm run build)`);
  return f;
}
export { page };
