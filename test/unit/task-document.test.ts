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
    f.write('agent.json', { agent: 'custom', conversations: [{ agent: 'custom', from: 123, sessionId: 'resume', terminal: 7 }] });
    f.write('terminals.json', { front: 7, list: [{ id: 7, conversation: 0 }] });
    f.write('profiles.json', [{ id: 'browser', closed: true, zoom: { localhost: 1.5 } }]);
    f.write('layout.json', { version: 3, workspace: { grid: { root: { type: 'branch', data: [] } }, panels: {} }, stage: null, stagePosition: 'left', stageShare: 0.4, stageLayout: 'tabs' });
    f.write('applications.json', { next: 10, list: [{ id: 9, name: 'CLI', command: 'node cli.js', size: null }] });
    assert.equal(f.task.agent().conversations[0].terminal, 7);
    const d = f.read(), id = d.agents.conversations[0].id;
    assert.equal(typeof id, 'string');
    assert.equal((f.task.layout() as { stagePosition: string; stageShare: number; stageLayout: string }).stagePosition, 'left');
    assert.equal((f.task.layout() as { stagePosition: string; stageShare: number; stageLayout: string }).stageShare, 0.4);
    assert.equal((f.task.layout() as { stagePosition: string; stageShare: number; stageLayout: string }).stageLayout, 'tabs');
    assert.equal(d.development.list[0].conversation, id);
    assert.equal('terminal' in d.agents.conversations[0], false);
    assert.equal(f.task.profiles()[0].closed, true);
    assert.equal(f.task.stageTerminals().next, 10);
    for (const name of ['agent', 'development-terminals', 'profiles', 'stage-terminals', 'layout']) assert.equal(fs.existsSync(f.task.file(name+'.json')), false);
    f.task.saveProfiles([]);
    assert.deepEqual(f.task.stageTerminals().list, d.stage.items.filter((i: { type: string }) => i.type === 'terminal').map(({ type: _type, ...config }: { type: string; [key: string]: unknown }) => config));
    f.task.saveStageTerminals({ next: 11, list: [] });
    assert.equal(f.task.agent().conversations[0].id, id);
    f.task.saveDevelopmentTerminals({ front: null, list: [] });
    assert.equal(f.task.agent().conversations[0].terminal, undefined);
    assert.equal(f.task.agent().conversations[0].sessionId, 'resume');
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
    const expected = { list: [{ id: 'open', name: 'Open' }, { id: 'closed', name: 'Closed', merged: true, closedAt: 123 }, { id: 'unknown', name: 'Unknown', closedAt: 0 }] };
    assert.deepEqual(f.store.tasksOf({ id: 'project' }), expected);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected);
    assert.deepEqual(f.store.tasksOf({ id: 'project' }), expected);
  } finally { f.close(); }
});
