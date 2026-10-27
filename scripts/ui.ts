// src/ui as shadcn's CLI makes it, never edited by hand (src/ui/README.md): made again from components.json and the
// components it has, or with new ones added.
//   npm run ui                 made again; the CI then refuses a difference (git diff)
//   npm run ui -- <name> …     a component of shadcn's added (its name in shadcn's registry: dropdown-menu)
// The CLI asks nothing with these flags and stdin closed (it waits for an answer otherwise). It also installs and
// rewrites dependencies: package.json and its lock are put back as they were, and what a new component needs is
// installed as a devDependency, as all of the window's (Vite bundles them).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = path.join(import.meta.dirname, '..');
const ui = path.join(root, 'src/ui');
const made = ['components', 'hooks', 'lib']; // the CLI's; index.ts, tsconfig.json and the docs are Kulisa's
const components = fs.readdirSync(path.join(ui, 'components/ui')).map((f) => path.basename(f, '.tsx')).sort(); // one order: the CLI writes a file differently as it comes first or as another's dependency

const shadcn = (...args: string[]) => {
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/shadcn/dist/index.js'), ...args],
    { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const pkg = path.join(root, 'package.json'), lock = path.join(root, 'package-lock.json');
const [pkgText, lockText] = [fs.readFileSync(pkg, 'utf8'), fs.readFileSync(lock, 'utf8')];
const deps = (text: string) => { const p = JSON.parse(text); return { ...p.dependencies, ...p.devDependencies } as Record<string, string>; };

for (const d of made) fs.rmSync(path.join(ui, d), { recursive: true, force: true });
fs.writeFileSync(path.join(ui, 'theme.css'), '@import "tailwindcss";\n'); // what init looks for, then writes over
shadcn('init', '-t', 'vite', '-b', 'radix', '-p', 'nova', '-y', '--no-monorepo', '--force', '--no-reinstall');
shadcn('add', '-y', '--overwrite', ...[...new Set([...components, ...process.argv.slice(2)])].sort());

const had = deps(pkgText), added = Object.keys(deps(fs.readFileSync(pkg, 'utf8'))).filter((d) => !(d in had));
fs.writeFileSync(pkg, pkgText);
fs.writeFileSync(lock, lockText);
if (added.length) spawnSync('npm', ['install', '--save-dev', ...added], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
