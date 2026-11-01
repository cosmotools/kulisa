// The layers (CLAUDE.md, Architecture) and no cycles, checked by dependency-cruiser (npm run deps, in npm run lint).
// The core layers check runtime imports; Kulisa packages check type dependencies too (docs/packages.md).
import type { IConfiguration } from 'dependency-cruiser';

// The core profile integration and automation access are lists of src/main's files; the Kulisa plugin is a Kulisa package. A file in none of them is the window's (layer 4).
// Base: git and what is local, used by every layer; nothing of src/main above them.
const base = '^src/main/(worktrees|remotes|local|log|files|remove|artifacts)\\.ts$';
const layer1 = '^src/main/(project-profiles|profile-store|store|signin-[a-z]+)\\.ts$';
const layer2 = '^src/main/(cdp-proxy|local-only)\\.ts$';
const main = '^src/main/';
const settings = '^src/renderer/components/settings/';

// A file of `from` imports nothing of src/main but `allowed`.
const only = (name: string, from: string, allowed: string[], comment: string) =>
  ({ name, comment, severity: 'error' as const, from: { path: from }, to: { path: main, pathNot: allowed, preCompilationOnly: false } });

// Kulisa packages (docs/packages.md): all of one in src/<package>/, reached from outside only
// through its entries (other packages' too); its main process half uses of src/main only what its line names, its window
// half nothing of the window. A new Kulisa package is a line here.
const packages: Record<string, { main: string[] }> = {
  'kulisa-plugin': { main: ['log', 'store', 'files', 'remove'] },
  browser: { main: ['log', 'files', 'local'] },
  terminal: { main: ['ipc', 'log'] }, // a terminal: its pty, its buffers and the xterm shown
  changes: { main: ['worktrees'] }, // local Git review; task ownership and window state are supplied by callers
  'project-explorer': { main: [] }, // a folder browser; roots and desktop actions come from the caller
  screenshots: { main: ['ipc', 'log'] }, // a picture of a page: an element, the visible part, the whole page
  // GitHub accounts and their sign-ins; store supplies ids, files supplies atomic writes.
  github: { main: ['ipc', 'log', 'store', 'files'] },
  'activity-monitor': { main: [] }, // what Kulisa takes on the computer; told of the tasks by the caller
  dictation: { main: ['ipc', 'log'] }, // dictation: what each task's microphone shows, and recording
};
const packageRules = (name: string, { main: uses }: { main: string[] }) => {
  const dir = `^src/${name}/`;
  return [
    { name: `${name}-entries`, severity: 'error' as const, comment: `${name}/ is reached through main/index.ts, renderer/index.ts and ipc.ts only.`,
      from: { pathNot: dir }, to: { path: dir, pathNot: `${dir}(main/index|renderer/index|ipc)\\.ts$` } },
    { name: `${name}-main`, severity: 'error' as const, comment: `${name}/main uses nothing of src/main but ${uses.join(', ')}.`,
      from: { path: `${dir}main/` }, to: { path: '^src/(main|renderer|preload)/', pathNot: `^src/main/(${uses.join('|')})\\.ts$` } },
    { name: `${name}-contracts`, severity: 'error' as const, comment: `${name}/ipc.ts declares contracts without core domain dependencies.`,
      from: { path: `${dir}ipc\\.ts$` }, to: { path: '^src/(main|renderer|preload)/' } },
    { name: `${name}-renderer`, severity: 'error' as const, comment: `${name}/renderer uses nothing of the window, nor of the main process.`,
      from: { path: `${dir}renderer/` }, to: { path: '^src/(renderer|main|preload)/' } },
    { name: `${name}-sides`, severity: 'error' as const, comment: `${name}'s two halves run in two processes: only types between them.`,
      from: { path: `${dir}(main|renderer)/` }, to: { preCompilationOnly: false, path: `${dir}(main|renderer)/`, pathNot: `${dir}$1/` } },
    { name: `${name}-window-side`, severity: 'error' as const, comment: `The window takes ${name}/renderer, the main process ${name}/main.`,
      from: { path: '^src/renderer/' }, to: { preCompilationOnly: false, path: `${dir}main/` } },
    { name: `${name}-main-side`, severity: 'error' as const, comment: `The window takes ${name}/renderer, the main process ${name}/main.`,
      from: { path: '^src/main/' }, to: { preCompilationOnly: false, path: `${dir}renderer/` } },
  ];
};

const config: IConfiguration = {
  forbidden: [
    only('base', base, [base], 'Git and what is local are used by every layer and use none of them.'),
    only('layer-1', layer1, [base, layer1], 'Profiles know nothing of automation, agents or the window.'),
    only('layer-2', layer2, [base, layer1, layer2], 'Automation access knows nothing of agents or the window.'),

    { name: 'shared', severity: 'error', comment: 'What the main process and the window share imports neither.',
      from: { path: '^src/shared/' }, to: { preCompilationOnly: false, path: '^src/', pathNot: '^src/shared/' } },
    { name: 'window-page', severity: 'error', comment: 'The window\'s page reaches the main process only over IPC; what both use is in src/shared.',
      from: { path: '^src/renderer/' }, to: { preCompilationOnly: false, path: '^src/(main|preload)/' } },
    { name: 'main-not-page', severity: 'error', comment: 'The main process takes only types of the window\'s page.',
      from: { path: '^src/main/' }, to: { preCompilationOnly: false, path: '^src/renderer/' } },
    { name: 'stage-terminal-host', severity: 'error', comment: 'Stage terminal lifecycle uses an explicit host contract; it imports no task, window or store, including their types.',
      from: { path: '^src/main/stage-terminals\\.ts$' },
      to: { path: '^src/main/', pathNot: '^src/main/log\\.ts$' } },
    ...Object.entries(packages).flatMap(([name, p]) => packageRules(name, p)),
    // src/ui, shadcn's components as its CLI makes them (src/ui/README.md): reached through its entry, using nothing of Kulisa.
    { name: 'ui-entry', severity: 'error', comment: 'src/ui is reached from outside through its index.ts only.',
      from: { pathNot: '^src/ui/' }, to: { path: '^src/ui/', pathNot: '^src/ui/index\\.ts$' } },
    { name: 'ui-alone', severity: 'error', comment: 'src/ui uses nothing of Kulisa.',
      from: { path: '^src/ui/' }, to: { path: '^src/', pathNot: '^src/ui/' } },
    // The window's logic apart from its look (docs/ui.md, The code): rewriting the components touches no logic, and the
    // logic never comes to depend on a look.
    { name: 'logic-not-look', severity: 'error', comment: 'src/renderer/lib/ imports no component, no UI library, no icons.',
      from: { path: '^src/renderer/lib/' },
      to: { path: ['^src/renderer/components/', '^src/ui/', 'node_modules/(lucide-react|radix-ui|@radix-ui)/'] } },
    // Settings is the window's chunk of its own, read as it is first shown (App.tsx): a static import pulls it into the
    // window's bundle.
    { name: 'settings-entry', severity: 'error', comment: 'components/settings/ is reached from outside only by import() of its index.ts.',
      from: { pathNot: settings }, to: { preCompilationOnly: false, path: settings, pathNot: `${settings}index\\.ts$` } },
    { name: 'settings-lazy', severity: 'error', comment: 'components/settings/ is imported from outside only by import() (App.tsx, lazy).',
      from: { pathNot: settings }, to: { preCompilationOnly: false, path: settings, dynamic: false } },
    { name: 'no-circular', severity: 'error', comment: 'A cycle at run time: one of its modules is loaded half done.',
      // grid.ts and views.ts call each other's functions only after both have loaded (the pages live again, then
      // the grid's boxes sent): a cycle without that danger, and passing one of them in would be code for the tool.
      from: { pathNot: '^src/renderer/lib/(grid|views)\\.ts$' }, to: { preCompilationOnly: false, circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } } },
  ],
  options: {
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' }, // its paths: src/ui's alias (@ui)
    exclude: { path: '^src/renderer/public/' },
  },
};

export default config;
