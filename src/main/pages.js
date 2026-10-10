// Kulisa's own pages (the window, a master's window): built from src/renderer by Vite into dist/renderer (vite.config.mts;
// npm start and npm test build them first, Forge before packaging).
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', '..', 'dist', 'renderer');
function page(file) {
  const f = path.join(DIST, file);
  if (!fs.existsSync(f)) console.error(`[kulisa] ${f} is missing: build the window first (npm run build)`);
  return f;
}
module.exports = { page };
