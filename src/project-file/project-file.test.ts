// A project's file in its repository (main/index.ts): its team read and written, the rest of it kept.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { teamIn, writeTeam, projectFile } from './main/index.ts';

let repo: string;
beforeEach(() => { repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-file-')); });
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));
const put = (v: unknown) => { fs.mkdirSync(path.join(repo, '.kulisa'), { recursive: true }); fs.writeFileSync(projectFile(repo), typeof v === 'string' ? v : JSON.stringify(v)); };

test("the team written keeps the file's other sections and each role's fields a later Kulisa added", () => {
  put({ later: { run: 'npm start' }, team: [{ id: 'ra', agent: 'claude', name: 'Builder', color: 'red' }] });
  assert.deepEqual(writeTeam(repo, [{ id: 'ra', agent: 'claude', name: 'Maker' }, { id: 'rb', agent: 'codex', default: true }]), {});
  assert.deepEqual(JSON.parse(fs.readFileSync(projectFile(repo), 'utf8')), {
    later: { run: 'npm start' }, team: [{ id: 'ra', agent: 'claude', name: 'Maker', color: 'red' }, { id: 'rb', agent: 'codex', default: true }] });
  assert.deepEqual(teamIn(repo), [{ id: 'ra', agent: 'claude', name: 'Maker' }, { id: 'rb', agent: 'codex', default: true }]);
});

test('a role edited by hand without an id or an agent is left out; a file that is not JSON has no team and is never written over', () => {
  put({ team: [{ agent: 'claude' }, { id: 'rc' }, { id: 'rd', agent: 'claude', about: '  checks  ' }, 'x'] });
  assert.deepEqual(teamIn(repo), [{ id: 'rd', agent: 'claude', about: 'checks' }]);
  put('{ "team": [ half');
  assert.deepEqual(teamIn(repo), []);
  assert.match(writeTeam(repo, []).error!, /is not JSON/);
  assert.equal(fs.readFileSync(projectFile(repo), 'utf8'), '{ "team": [ half');
});

test('no file: no team; the first role written makes it', () => {
  assert.deepEqual(teamIn(repo), []);
  writeTeam(repo, [{ id: 're', agent: 'claude' }]);
  assert.deepEqual(teamIn(repo), [{ id: 're', agent: 'claude' }]);
});
