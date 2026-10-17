// Kulisa's version is package.json's alone (CLAUDE.md, Releases). Claude Code's plugin manifest carries one too, a field
// its format wants: written from package.json's here, which npm runs at npm version (the version script), so the two
// never part; test/unit/forge.test.ts refuses them apart.
import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = path.join(root, 'src/agent/claude-plugin/.claude-plugin/plugin.json');
fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, 'utf8')), version }, null, 2) + '\n');
console.log(`plugin.json: ${version}`);
