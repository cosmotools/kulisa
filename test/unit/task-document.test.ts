// Task document integrity and section ownership, without Electron or the author's data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../../src/main/store.ts';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-task-document-'));
  const store = new Store(root), task = store.taskOf({ id: 'project' }, 'task');
  const write = (name: string, value: unknown) => fs.writeFileSync(task.file(name), JSON.stringify(value));
  const read = () => JSON.parse(fs.readFileSync(task.file('task.json'), 'utf8'));
  return { task, store, write, read, close: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('task updates preserve history, setup, stable links and unknown metadata in unrelated sections', () => {
  const f = fixture();
  try {
    f.task.saveAgent({ agent: 'custom', conversations: [{ agent: 'custom', from: 123, sessionId: 'resume' }] });
    f.task.saveDevelopmentTerminals({ front: 7, list: [{ id: 7, conversation: 0 }] });
    f.task.saveProfiles([{ id: 'browser', closed: true, zoom: { localhost: 1.5 } }]);
    f.task.saveStageTerminals({ next: 10, list: [{ id: 9, name: 'CLI', command: 'node cli.js', size: null }] });
    const split = { grid: { width: 1000, height: 1000, orientation: 'HORIZONTAL', root: { type: 'branch', size: 1000, data: [
      { type: 'leaf', size: 400, data: { id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 } },
      { type: 'leaf', size: 600, data: { id: 'development', component: 'development', minimumWidth: 100, minimumHeight: 100 } },
    ] } } };
    f.task.saveLayout({ version: 4, workspace: { width: 420, collapsed: true }, stage: null, split, stagePosition: 'left', stageLayout: 'tabs' });
    const artifact = path.join(f.task.artifacts, 'reports', 'result.html');
    f.task.savePresentation({ ...f.task.presentation(), workbenchItem: 'artifacts', selectedArtifact: artifact });
    const d = f.read(), id = d.agents.conversations[0].id;
    d.future = { enabled: true };
    d.agents.conversations[0].future = 'adapter metadata';
    d.stage.items.find((item: { type: string }) => item.type === 'profile').future = 'profile metadata';
    f.write('task.json', d);
    assert.equal(typeof id, 'string');
    assert.equal(f.task.agent().conversations[0].terminal, 7);
    const layout = f.task.layout() as { stagePosition: string; split: unknown; stageLayout: string };
    assert.equal(layout.stagePosition, 'left');
    assert.deepEqual(layout.split, split);
    assert.equal(layout.stageLayout, 'tabs');
    assert.deepEqual(f.read().workspace.sidebar, { width: 420, collapsed: true });
    assert.equal(f.read().workspace.selectedArtifact, path.join('reports', 'result.html'));
    assert.equal(f.task.presentation().selectedArtifact, artifact);
    assert.equal(f.task.presentation().workbenchItem, 'artifacts');
    assert.equal(d.development.list[0].conversation, id);
    assert.equal('terminal' in d.agents.conversations[0], false);
    assert.deepEqual(f.task.profiles()[0], { id: 'browser', closed: true, zoom: { localhost: 1.5 }, future: 'profile metadata' });
    f.task.saveProfiles([]);
    assert.deepEqual(f.task.stageTerminals(), { next: 10, list: [{ id: 9, name: 'CLI', command: 'node cli.js', size: null }] });
    f.task.saveStageTerminals({ next: 11, list: [] });
    assert.equal(f.task.agent().conversations[0].id, id);
    f.task.saveDevelopmentTerminals({ front: null, list: [] });
    assert.equal(f.task.agent().conversations[0].terminal, undefined);
    assert.equal(f.task.agent().conversations[0].sessionId, 'resume');
    assert.equal(f.read().agents.conversations[0].future, 'adapter metadata');
    assert.deepEqual(f.read().future, { enabled: true });
    assert.equal(f.store.taskOf({ id: 'project' }, 'task').agent().agent, 'custom');
  } finally { f.close(); }
});

test('only development distinguishes first load from deliberately empty; stable references survive history reorder', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.task.profiles(), []);
    assert.equal(f.task.developmentTerminals(), null);
    f.task.saveProfiles([{ id: 'closed', closed: true }, { id: 'empty-zoom', closed: true, zoom: {} }]);
    assert.deepEqual(f.task.profiles(), []);
    assert.deepEqual(f.read().stage, { nextTerminalId: 1, items: [] });
    assert.deepEqual(f.read().workspace, {});
    f.task.saveAgent({ conversations: [{ agent: 'a', from: 1 }, { agent: 'b', from: 2 }] });
    f.task.saveDevelopmentTerminals({ front: 4, list: [{ id: 4, conversation: 0 }] });
    const a = f.task.agent(); a.conversations.reverse(); f.task.saveAgent(a);
    assert.equal(f.task.developmentTerminals().list[0].conversation, 1);
    f.task.saveDevelopmentTerminals({ front: null, list: [] });
    assert.deepEqual(f.task.profiles(), []);
    assert.deepEqual(f.task.developmentTerminals(), { front: null, list: [] });
  } finally { f.close(); }
});

test('malformed and unsupported task documents are rejected without overwriting them', () => {
  const f = fixture();
  try {
    const file = f.task.file('task.json');
    fs.writeFileSync(file, '{bad');
    assert.throws(() => f.task.agent(), /Cannot read task data/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{bad');
    f.write('task.json', { version: 99 });
    assert.throws(() => f.task.agent(), /Invalid task/);
    assert.deepEqual(f.read(), { version: 99 });
  } finally { f.close(); }
});

test('the shared tmp parent cannot redirect conversation files through a symbolic link', (t) => {
  const f = fixture(), outside = path.join(f.store.dir, 'external');
  try {
    fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'notes.txt'), 'keep');
    try { fs.symlinkSync(outside, f.task.temporary, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') return t.skip('Creating links requires OS privileges.'); throw error; }
    assert.throws(() => f.task.prepareTemporary(), /symbolic link/);
    assert.deepEqual(fs.readdirSync(outside), ['notes.txt']);
  } finally { f.close(); }
});
