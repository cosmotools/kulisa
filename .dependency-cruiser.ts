// The layers (CLAUDE.md, Architecture) and no cycles, checked by dependency-cruiser (npm run deps, in npm run lint).
// Runtime imports only: `import type` crosses the layers freely, as it is gone once the types are stripped
// (tsPreCompilationDeps off, its default). docs/testing.md, "Layers".
import type { IConfiguration } from 'dependency-cruiser';

// There are no folders per layer: each is a list of src/main's files. A file in none of them is the window's (layer 4).
// Base: git and what is local, used by every layer; nothing of src/main above them.
const base = '^src/main/(worktrees|local)\\.ts$';
const layer1 = '^src/main/(profiles|page-focus|project-profiles|profile-store|store|session-cookies|cookie-sync|signin-[a-z]+)\\.ts$';
const layer2 = '^src/main/(cdp-proxy|local-only)\\.ts$';
const layer3 = '^src/main/(mcp-server|agent-hooks|history|transcripts|ghost)\\.ts$';
const main = '^src/main/';

// A file of `from` imports nothing of src/main but `allowed`.
const only = (name: string, from: string, allowed: string[], comment: string) =>
  ({ name, comment, severity: 'error' as const, from: { path: from }, to: { path: main, pathNot: allowed } });

// The window's clusters: a part of several files with a state of its own, in a folder of src/renderer/components,
// reached from outside only through its entries (docs/ui.md, Clusters). A new cluster is a line here.
const clusters: Record<string, string[]> = {
  newproject: ['NewProject', 'Wizard'], // New Project's steps: a dialog, and the welcome's
  settings: ['Settings'], // Settings' window
  newtab: ['Board'], // every project with its tasks: a new tab's, the empty window's
  welcome: ['Welcome'], // the first start: what Kulisa does, then New Project's steps
};
const cluster = (name: string, entries: string[]) => {
  const dir = `^src/renderer/components/${name}/`;
  return { name: `cluster-${name}`, severity: 'error' as const, comment: `${name}/ is reached through ${entries.join(', ')} only: its other files are its own.`,
    from: { pathNot: dir }, to: { path: dir, pathNot: `${dir}(${entries.join('|')})\\.vue$` } };
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
    ...Object.entries(clusters).map(([name, entries]) => cluster(name, entries)),
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
