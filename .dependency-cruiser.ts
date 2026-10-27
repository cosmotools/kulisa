// The layers (CLAUDE.md, Architecture) and no cycles, checked by dependency-cruiser (npm run deps, in npm run lint).
// Runtime imports only: `import type` crosses the layers freely, as it is gone once the types are stripped
// (tsPreCompilationDeps off, its default). docs/testing.md, "Layers".
import type { IConfiguration } from 'dependency-cruiser';

// Layers 1 and 2 are lists of src/main's files, layer 3 a folder. A file in none of them is the window's (layer 4).
// Base: git and what is local, used by every layer; nothing of src/main above them.
const base = '^src/main/(worktrees|remotes|local|log|remove)\\.ts$';
const layer1 = '^src/main/(profiles|page-focus|project-profiles|profile-store|store|session-cookies|cookie-sync|signin-[a-z]+)\\.ts$';
const layer2 = '^src/main/(cdp-proxy|local-only)\\.ts$';
const layer3 = '^src/main/kulisa-plugin/';
const main = '^src/main/';
const settings = '^src/renderer/components/settings/';

// A file of `from` imports nothing of src/main but `allowed`.
const only = (name: string, from: string, allowed: string[], comment: string) =>
  ({ name, comment, severity: 'error' as const, from: { path: from }, to: { path: main, pathNot: allowed } });

// Kulisa packages (docs/packages.md): all of one in src/<package>/, reached from outside only
// through its entries (other packages' too); its main process half uses of src/main only what its line names, its window
// half nothing of the window. A new Kulisa package is a line here.
const packages: Record<string, { main: string[] }> = {
  terminal: { main: ['ipc', 'log'] }, // a terminal: its pty, its buffers and the xterm shown
  screenshots: { main: ['ipc', 'log'] }, // a picture of a page: an element, the visible part, the whole page
  // GitHub accounts and their sign-ins; store for its file's id and its atomic write, the data folder's own.
  github: { main: ['ipc', 'log', 'store'] },
  'activity-monitor': { main: [] }, // what Kulisa takes on the computer; told of the tasks by the caller
  dictation: { main: ['ipc', 'log'] }, // dictation: what each task's microphone shows, and recording
};
const packageRules = (name: string, { main: uses }: { main: string[] }) => {
  const dir = `^src/${name}/`;
  return [
    { name: `${name}-entries`, severity: 'error' as const, comment: `${name}/ is reached through main/index.ts, renderer/index.ts and ipc.ts only.`,
      from: { pathNot: dir }, to: { path: dir, pathNot: `${dir}(main/index|renderer/index|ipc)\\.ts$` } },
    { name: `${name}-main`, severity: 'error' as const, comment: `${name}/main uses nothing of src/main but ${uses.join(', ')}.`,
      from: { path: `${dir}main/` }, to: { path: main, pathNot: `^src/main/(${uses.join('|')})\\.ts$` } },
    { name: `${name}-renderer`, severity: 'error' as const, comment: `${name}/renderer uses nothing of the window, nor of the main process.`,
      from: { path: `${dir}renderer/` }, to: { path: '^src/(renderer|main|preload)/' } },
    { name: `${name}-sides`, severity: 'error' as const, comment: `${name}'s two halves run in two processes: only types between them.`,
      from: { path: `${dir}(main|renderer)/` }, to: { path: `${dir}(main|renderer)/`, pathNot: `${dir}$1/` } },
    { name: `${name}-window-side`, severity: 'error' as const, comment: `The window takes ${name}/renderer, the main process ${name}/main.`,
      from: { path: '^src/renderer/' }, to: { path: `${dir}main/` } },
    { name: `${name}-main-side`, severity: 'error' as const, comment: `The window takes ${name}/renderer, the main process ${name}/main.`,
      from: { path: '^src/main/' }, to: { path: `${dir}renderer/` } },
  ];
};

const config: IConfiguration = {
  forbidden: [
    only('base', base, [base], 'Git and what is local are used by every layer and use none of them.'),
    only('layer-1', layer1, [base, layer1], 'Profiles know nothing of automation, agents or the window.'),
    only('layer-2', layer2, [base, layer1, layer2], 'Automation access knows nothing of agents or the window.'),
    only('layer-3', layer3, [base, layer1, layer2, layer3], 'The Kulisa plugin knows the window (tasks, terminals) only as types: Shell gives it them.'),
    { name: 'shared', severity: 'error', comment: 'What the main process and the window share imports neither.',
      from: { path: '^src/shared/' }, to: { path: '^src/', pathNot: '^src/shared/' } },
    { name: 'window-page', severity: 'error', comment: 'The window\'s page reaches the main process only over IPC; what both use is in src/shared.',
      from: { path: '^src/renderer/' }, to: { path: '^src/(main|preload)/' } },
    { name: 'main-not-page', severity: 'error', comment: 'The main process takes only types of the window\'s page.',
      from: { path: '^src/main/' }, to: { path: '^src/renderer/' } },
    { name: 'agents-entry', severity: 'error',
      comment: 'src/main/agents/ is reached from outside through index.ts only (the agent contract\'s types cross freely as import type).',
      from: { pathNot: '^src/main/agents/' }, to: { path: '^src/main/agents/', pathNot: '^src/main/agents/index\\.ts$' } },
    ...Object.entries(packages).flatMap(([name, p]) => packageRules(name, p)),
    // Settings is the window's chunk of its own, read as it is first shown (App.tsx): a static import pulls it into the
    // window's bundle.
    { name: 'settings-entry', severity: 'error', comment: 'components/settings/ is reached from outside only by import() of its index.ts.',
      from: { pathNot: settings }, to: { path: settings, pathNot: `${settings}index\\.ts$` } },
    { name: 'settings-lazy', severity: 'error', comment: 'components/settings/ is imported from outside only by import() (App.tsx, lazy).',
      from: { pathNot: settings }, to: { path: settings, dynamic: false } },
    { name: 'no-circular', severity: 'error', comment: 'A cycle at run time: one of its modules is loaded half done.',
      // grid.ts and views.ts call each other's functions only after both have loaded (the pages live again, then
      // the grid's boxes sent): a cycle without that danger, and passing one of them in would be code for the tool.
      from: { pathNot: '^src/renderer/lib/(grid|views)\\.ts$' }, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/renderer/public/' },
  },
};

export default config;
