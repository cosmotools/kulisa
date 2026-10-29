// Accounts owned by Kulisa's core (docs/tasks.md, Accounts).
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Accounts } from '../../src/main/accounts.ts';
import { shortEmail } from '../../src/main/log.ts';
import { drawing } from './drawing.ts';
import type { Agent } from '../../src/kulisa-plugin/main/index.ts';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test("accounts: one store, kept until deleted; its folder a fixed id, random, the email kept; an agent with accounts is no account itself", () => {
  const data = path.join(root, 'accounts-data');
  const defs = [{ id: 'claude', name: 'Claude Code', config: { env: 'CLAUDE_CONFIG_DIR', home: () => '/nowhere', login: (): string[] => [] } }, { id: 'shell', name: 'Terminal only' }] as Agent[];
  const marked: string[] = [];
  const accounts = new Accounts(data, defs, (d) => { marked.push(d); });
  assert.deepEqual(accounts.all().map((a) => [a.id, a.own, a.choosable]), [['claude', true, false], ['shell', true, true]], "the human's own ~/.claude is no account");
  assert.deepEqual(accounts.choosable().map((a) => a.id), ['shell']);
  const r = accounts.prepare('claude') as { id: string; dir: string };
  assert.match(r.id, /^[a-z0-9]{6}$/);
  assert.equal(r.dir, path.join(data, 'agents', `claude-${r.id}`), 'its folder its agent and its id');
  assert.ok(fs.existsSync(r.dir), 'its folder made before the sign-in');
  assert.match(accounts.prepare('shell').error, /has no accounts/);
  const ann = accounts.create(r.id, 'claude', 'ann@shop.com');
  assert.deepEqual([ann.id, ann.name, ann.dir, ann.own, ann.choosable], [r.id, 'Claude Code · ann@shop.com', r.dir, false, true]);
  assert.equal(accounts.byEmail('claude', 'ann@shop.com').id, r.id, 'an email it has already: that account');
  assert.equal(accounts.byEmail('claude', null), null);
  assert.deepEqual(new Accounts(data, defs).all().map((a) => a.id), ['claude', r.id, 'shell'], 'kept');
  const cy = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'cy@shop.com');
  assert.notEqual(cy.id, r.id);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data, 'agents.json'), 'utf8')).list, [{ id: r.id, agent: 'claude', email: 'ann@shop.com' }, { id: cy.id, agent: 'claude', email: 'cy@shop.com' }]);
  // Deleted, it goes (a sign-in is made again only by signing in again).
  accounts.drop(r.id);
  accounts.drop(cy.id);
  assert.equal(accounts.find(r.id), null);
  accounts.remove(r.dir);
  assert.ok(!fs.existsSync(r.dir) && marked.includes(r.dir), 'its folder gone');
  // Drawn again while an agent or an account has the id or its folder is there (a removed one's may wait for the next
  // start).
  accounts.create('aaaaaa', 'claude', 'dee@shop.com');
  fs.mkdirSync(path.join(data, 'agents', 'claude-bbbbbb'));
  const undraw = drawing('claude', 'aaaaaa', 'bbbbbb', 'cccccc');
  try { assert.equal((accounts.prepare('claude') as { id: string }).id, 'cccccc'); } finally { undraw(); }
  accounts.drop('aaaaaa');
  // At start: a sign-in that did not end, and the format before (accounts.json), go.
  fs.writeFileSync(path.join(data, 'accounts.json'), '[]');
  const bob = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'bob@shop.com');
  new Accounts(data, defs, (d) => { marked.push(d); }).clean();
  assert.deepEqual(fs.readdirSync(path.join(data, 'agents')), [`claude-${bob.id}`]);
  assert.ok(!fs.existsSync(path.join(data, 'accounts.json')));
});

test('accounts: the log names an id by its agent and its email, shortened', () => {
  assert.equal(shortEmail('myqoop@gmail.com'), 'myq…@gmail.com');
  assert.equal(shortEmail('al@shop.com'), 'a…@shop.com', 'at most half of a short name');
  assert.equal(shortEmail('nobody'), '…');
  const accounts = new Accounts(path.join(root, 'labels-data'), [{ id: 'claude', name: 'Claude Code', config: { env: 'CLAUDE_CONFIG_DIR', home: () => '/nowhere', login: (): string[] => [] } }] as Agent[]);
  const ann = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'ann@shop.com'), bob = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', null);
  assert.equal(accounts.label(ann.id), `${ann.id} (Claude Code, an…@shop.com)`);
  assert.equal(accounts.label(bob.id), `${bob.id} (Claude Code)`);
  assert.equal(accounts.label('claude'), 'Claude Code', 'an agent itself');
  assert.equal(accounts.label('gone12'), 'gone12');
});
