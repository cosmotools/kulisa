// Task data migration and section ownership, without Electron or the author's data.
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

test('task migration preserves history, setup and stable links, removes legacy files, and preserves unrelated updates', () => {
  const f = fixture();
  try {
    f.write('agent.json', { agent: 'custom', conversations: [{ agent: 'custom', from: 123, sessionId: 'resume', terminal: 7, future: 'adapter metadata' }] });
    f.write('terminals.json', { front: 7, list: [{ id: 7, conversation: 0 }] });
    f.write('profiles.json', [{ id: 'browser', closed: true, zoom: { localhost: 1.5 } }]);
    const split = { grid: { width: 1000, height: 1000, orientation: 'HORIZONTAL', root: { type: 'branch', size: 1000, data: [
      { type: 'leaf', size: 400, data: { id: 'stage', component: 'stage', minimumWidth: 100, minimumHeight: 100 } },
      { type: 'leaf', size: 600, data: { id: 'development', component: 'development', minimumWidth: 100, minimumHeight: 100 } },
    ] } } };
    f.write('layout.json', { version: 3, workspace: { grid: { root: { type: 'branch', data: [] } }, panels: {} }, stage: null, stageShare: 0.4, stagePosition: 'left', stageLayout: 'tabs' });
    f.write('applications.json', { next: 10, list: [{ id: 9, name: 'CLI', command: 'node cli.js', size: null }] });
    assert.equal(f.task.agent().conversations[0].terminal, 7);
    const d = f.read(), id = d.agents.conversations[0].id;
    assert.equal(typeof id, 'string');
    f.write('task.json', { ...d, future: { enabled: true } });
    const layout = f.task.layout() as { stagePosition: string; split: unknown; stageLayout: string };
    assert.equal(layout.stagePosition, 'left');
    assert.deepEqual(layout.split, split);
    assert.equal(layout.stageLayout, 'tabs');
    assert.equal(d.development.list[0].conversation, id);
    assert.equal('terminal' in d.agents.conversations[0], false);
    assert.equal(f.task.profiles()[0].closed, true);
    assert.equal(f.task.stageTerminals().next, 10);
    for (const name of ['agent', 'terminals', 'profiles', 'applications', 'layout']) assert.equal(fs.existsSync(f.task.file(name+'.json')), false);
    f.task.saveProfiles([]);
    assert.deepEqual(f.task.stageTerminals().list, d.stage.items.filter((i: { type: string }) => i.type === 'terminal').map(({ type: _type, ...config }: { type: string; [key: string]: unknown }) => config));
    f.task.saveStageTerminals({ next: 11, list: [] });
    assert.equal(f.task.agent().conversations[0].id, id);
    f.task.saveDevelopmentTerminals({ front: null, list: [] });
    assert.equal(f.task.agent().conversations[0].terminal, undefined);
    assert.equal(f.task.agent().conversations[0].sessionId, 'resume');
    assert.equal(f.read().agents.conversations[0].future, 'adapter metadata');
    assert.deepEqual(f.read().future, { enabled: true });
    f.write('agent.json', { agent: 'stale' });
    assert.equal(f.store.taskOf({ id: 'project' }, 'task').agent().agent, 'custom');
    assert.equal(fs.existsSync(f.task.file('agent.json')), false);
  } finally { f.close(); }
});

test('new and deliberately empty tasks remain distinct; stable references survive history reorder', () => {
  const f = fixture();
  try {
    assert.equal(f.task.profiles(), null);
    assert.equal(f.task.developmentTerminals(), null);
    f.task.saveProfiles([]);
    f.task.saveAgent({ conversations: [{ agent: 'a', from: 1 }, { agent: 'b', from: 2 }] });
    f.task.saveDevelopmentTerminals({ front: 4, list: [{ id: 4, conversation: 0 }] });
    const a = f.task.agent(); a.conversations.reverse(); f.task.saveAgent(a);
    assert.equal(f.task.developmentTerminals().list[0].conversation, 1);
    f.task.saveDevelopmentTerminals({ front: null, list: [] });
    assert.deepEqual(f.task.profiles(), []);
    assert.deepEqual(f.task.developmentTerminals(), { front: null, list: [] });
  } finally { f.close(); }
});

test('malformed source and failed atomic migration preserve original data', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.task.file('agent.json'), '{bad');
    assert.throws(() => f.task.agent(), /Cannot read task data/);
    assert.equal(fs.existsSync(f.task.file('task.json')), false);
    f.write('agent.json', { agent: 'custom' });
    const write = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error('interrupted migration'); };
    try { assert.throws(() => f.task.agent(), /interrupted migration/); } finally { fs.writeFileSync = write; }
    assert.equal(fs.existsSync(f.task.file('task.json')), false);
    assert.equal(JSON.parse(fs.readFileSync(f.task.file('agent.json'), 'utf8')).agent, 'custom');
    f.write('task.json', { version: 99 });
    assert.throws(() => f.task.agent(), /Invalid task/);
    assert.equal(fs.existsSync(f.task.file('agent.json')), true);
  } finally { f.close(); }
});


test('version 1 task documents upgrade flat Stage items without changing IDs, layout or history', () => {
  const f = fixture();
  try {
    f.task.saveProfiles([{ id: 'browser', closed: true }]);
    f.task.saveStageTerminals({ next: 8, list: [{ id: 7, name: 'CLI', command: 'node cli.js', size: null }] });
    const current = f.read();
    const { profilesInitialized, items, ...stage } = current.stage;
    f.write('task.json', { ...current, version: 1, stage: { ...stage, initialized: profilesInitialized,
      items: items.map(({ type, ...config }: { type: string; [key: string]: unknown }) => ({ type, config })) } });
    assert.equal(f.task.profiles()[0].id, 'browser');
    assert.deepEqual(f.read(), current);
    f.write('agent.json', { agent: 'stale' });
    f.task.agent();
    assert.equal(fs.existsSync(f.task.file('agent.json')), true, 'cleanup is done once by this store');
    f.store.taskOf({ id: 'project' }, 'task').agent();
    assert.equal(fs.existsSync(f.task.file('agent.json')), false, 'reopening cleans leftover legacy data');
  } finally { f.close(); }
});

test('task index migrates closure into one timestamp, preserving open tasks and unknown closing times', () => {
  const f = fixture();
  try {
    const file = path.join(f.task.dir, '..', 'tasks.json');
    fs.writeFileSync(file, JSON.stringify({ list: [
      { id: 'open', name: 'Open', closed: false },
      { id: 'closed', name: 'Closed', closed: true, closedAt: 123, merged: true },
      { id: 'unknown', name: 'Unknown', closed: true },
    ] }));
    const expected = { list: [{ id: 'open', name: 'Open' }, { id: 'closed', name: 'Closed', closedAt: 123 }, { id: 'unknown', name: 'Unknown', closedAt: 0 }] };
    assert.deepEqual(f.store.tasksOf({ id: 'project' }), expected);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected);
    assert.deepEqual(f.store.tasksOf({ id: 'project' }), expected);
  } finally { f.close(); }
});

test('temporary folders move under tmp with their contents and ownership intact; closed-task usage includes old paths', () => {
  const f = fixture();
  try {
    for (const session of ['conversation-one', 'external-context']) {
      const previous = f.task.file(`tmp-agent-${session}`);
      fs.mkdirSync(path.join(previous, 'browser-check'), { recursive: true });
      fs.writeFileSync(path.join(previous, 'browser-check', 'notes.txt'), session);
    }
    const before = f.store.temporaryFoldersOf({ id: 'project' }, 'task');
    assert.equal(before.length, 3);
    f.task.prepareTemporary();
    for (const session of ['conversation-one', 'external-context']) {
      const folder = f.task.temporaryDir(session);
      assert.equal(fs.readFileSync(path.join(folder, 'browser-check', 'notes.txt'), 'utf8'), session);
      assert.equal(fs.existsSync(f.task.file(`tmp-agent-${session}`)), false);
    }
    f.task.prepareTemporary();
    assert.deepEqual(f.store.temporaryFoldersOf({ id: 'project' }, 'task'), [f.task.temporary]);
  } finally { f.close(); }
});

test('temporary conversion preserves both folders when their destinations conflict', () => {
  const f = fixture();
  try {
    const previous = f.task.file('tmp-agent-one'), current = f.task.temporaryDir('one');
    fs.mkdirSync(previous); fs.mkdirSync(current, { recursive: true });
    fs.writeFileSync(path.join(previous, 'notes.txt'), 'previous'); fs.writeFileSync(path.join(current, 'notes.txt'), 'current');
    assert.throws(() => f.task.prepareTemporary(), /Both temporary folders exist/);
    assert.equal(fs.readFileSync(path.join(previous, 'notes.txt'), 'utf8'), 'previous');
    assert.equal(fs.readFileSync(path.join(current, 'notes.txt'), 'utf8'), 'current');
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
