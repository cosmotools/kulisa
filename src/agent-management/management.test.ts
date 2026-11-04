// Sign-in lifecycle across asynchronous discovery and terminal startup (README.md). No real CLI credentials or pty.
import { test } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Accounts } from './main/index.ts';
import type { Agent } from '../kulisa-plugin/main/index.ts';
import type { Pty } from '../terminal/main/index.ts';

function setup(t: { after(fn: () => void): void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-agent-management-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const agent: Agent = { id: 'test', name: 'Test agent', maker: '', needs: '', custom: true, command: process.execPath,
    config: { env: 'KULISA_TEST_AGENT_CONFIG', home: () => root, login: () => [],
      status: ['-e', 'console.log("signed in")'], email: () => 'test@example.test', logout: ['-e', ''] } };
  return { root, agent };
}

test('discovery: cached results are scoped to folders and old task folders are evicted', async (t) => {
  const { root, agent } = setup(t);
  const manager = new Accounts(root, [{ ...agent, command: null }]), choices = manager.all();
  assert.deepEqual(await manager.list(choices, 'first', { check: true, cached: true }), { list: null });
  const first = await manager.list(choices, 'first', { check: true });
  assert.deepEqual(await manager.list(choices, 'first', { check: true, cached: true }), first);
  assert.deepEqual(await manager.list(choices, 'other', { check: true, cached: true }), { list: null });
  // More contexts than the bounded cache retains, without launching a CLI or touching their folders.
  for (let i = 0; i < 256; i++) await manager.list(choices, `task-${i}`, { check: true });
  assert.deepEqual(await manager.list(choices, 'first', { check: true, cached: true }), { list: null });
  const recent = await manager.list(choices, 'task-255', { check: true, cached: true });
  assert.ok(recent.list?.[0]?.installed);
});

test('sign-in: a failed terminal start removes its unregistered configuration and releases its key', async (t) => {
  const { root, agent } = setup(t);
  const forgotten: string[] = [];
  const manager = new Accounts(root, [agent], undefined, { terminals: async () => ({
    startTerminal: async () => { throw new Error('terminal could not start'); },
    stopTerminal: () => assert.fail('no terminal was created'), forgetTerminal: (key) => forgotten.push(key),
  }) });
  await assert.rejects(manager.signIn('test', 'failed', () => {}), /terminal could not start/);
  assert.deepEqual(manager.stored(), []);
  assert.deepEqual(fs.readdirSync(path.join(root, 'agents')), []);
  assert.equal(manager.signins.size, 0);
  assert.ok(forgotten.includes('failed'));
});

test('sign-in: cancelling during discovery prevents configuration and terminal creation', async (t) => {
  const { root, agent } = setup(t);
  const manager = new Accounts(root, [agent], undefined, { terminals: async () => assert.fail('cancelled before terminal loading') });
  const result = manager.signIn('test', 'early', () => {});
  await manager.cancel('early');
  assert.deepEqual(await result, { error: null });
  assert.deepEqual(manager.stored(), []);
  assert.equal(fs.existsSync(path.join(root, 'agents')), false);
  assert.equal(manager.signins.size, 0);
});

test('sign-in: cancelling during terminal creation stops the late terminal and removes its signed-in configuration', async (t) => {
  const { root, agent } = setup(t);
  let started!: () => void, finish!: (pty: Pty) => void, exit!: (event: { exitCode: number }) => void;
  const starting = new Promise<void>((resolve) => { started = resolve; });
  const terminal = new Promise<Pty>((resolve) => { finish = resolve; });
  let stopped = false;
  const pty = { onExit: (listener: typeof exit) => { exit = listener; } } as Pty;
  const manager = new Accounts(root, [agent], undefined, { terminals: async () => ({
    startTerminal: () => { started(); return terminal; },
    stopTerminal: (running) => { assert.equal(running, pty); stopped = true; exit({ exitCode: 0 }); },
    forgetTerminal: () => {},
  }) });
  const result = manager.signIn('test', 'late', () => {});
  await starting;
  await manager.cancel('late');
  finish(pty);
  assert.deepEqual(await result, { error: null });
  assert.equal(stopped, true);
  assert.deepEqual(manager.stored(), []);
  assert.deepEqual(fs.readdirSync(path.join(root, 'agents')), []);
  assert.equal(manager.signins.size, 0);
});
