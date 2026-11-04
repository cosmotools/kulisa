// Settings' Query integration: shared reads, late IPC replies and cover-owned retention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCancelledError, QueryObserver } from '@tanstack/react-query';
import { createSettingsQuery } from '../../src/renderer/components/settings/query.ts';
import type { ProjectSettings, SettingsProfile } from '../../src/shared/types.ts';

const profile = (name: string): SettingsProfile => ({ id: 'profile', name, avatar: 'fox', description: '', login: '', hasPassword: false, projects: [] });
function pending() {
  return Promise.withResolvers<SettingsProfile[]>();
}
function observed(read: () => Promise<SettingsProfile[]>) {
  const session = createSettingsQuery(['profiles'], read);
  const observer = new QueryObserver(session.client, { ...session.options, enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  return { ...session, close: () => { unsubscribe(); session.dispose(); } };
}

test('Settings shares concurrent profile reads; another window has its own query', async (t) => {
  const response = pending();
  let reads = 0;
  const session = observed(() => { ++reads; return response.promise; });
  const other = observed(async () => [profile('Other window')]);
  t.after(session.close); t.after(other.close);
  const first = session.load(), second = session.load();
  assert.equal(reads, 1);
  response.resolve([profile('Current')]);
  assert.deepEqual(await first, [profile('Current')]);
  assert.deepEqual(await second, [profile('Current')]);
  assert.deepEqual(await other.load(), [profile('Other window')]);
  assert.deepEqual(session.client.getQueryData(session.options.queryKey), [profile('Current')]);
});

test('a change event replaces an unfinished initial read and discards its late IPC reply', async (t) => {
  const old = pending(), current = pending();
  let reads = 0;
  const session = observed(() => ++reads === 1 ? old.promise : current.promise);
  t.after(session.close);
  const retired = session.load().catch((error: unknown) => { assert.ok(isCancelledError(error)); });
  const refreshed = session.refresh();
  assert.equal(reads, 2);
  current.resolve([profile('Renamed')]);
  await refreshed;
  old.resolve([profile('Old name')]);
  await retired;
  assert.deepEqual(session.client.getQueryData(session.options.queryKey), [profile('Renamed')]);
});

test('a mutation response survives an older profile read arriving afterwards', async (t) => {
  const old = pending();
  const session = observed(() => old.promise);
  t.after(session.close);
  const retired = session.load().catch((error: unknown) => { assert.ok(isCancelledError(error)); });
  session.update([profile('Saved')]);
  old.resolve([profile('Before saving')]);
  await retired;
  assert.deepEqual(session.client.getQueryData(session.options.queryKey), [profile('Saved')]);
});

test('closing Settings drops its cache and prevents late reads or mutation replies from rebuilding it', async (t) => {
  const response = pending();
  let reads = 0;
  const session = observed(() => { ++reads; return response.promise; });
  t.after(session.close);
  const cancelled = assert.rejects(session.load(), isCancelledError);
  session.dispose();
  response.resolve([profile('Late')]);
  await cancelled;
  session.update([profile('Late mutation')]);
  await assert.rejects(session.refresh(), isCancelledError);
  assert.equal(reads, 1);
  assert.deepEqual(session.client.getQueryCache().getAll(), []);
});

const project = (): ProjectSettings => ({ name: 'Project', local: ['shop.dev'], folders: [], projectAgents: [], profiles: [], others: [], agents: [], clis: [] });

test('a prefetched project needs no second read; its first change event reads fresh data', async (t) => {
  let reads = 0;
  const first = project();
  const changed: ProjectSettings = { ...first, profiles: [{ id: 'new', name: 'New', avatar: 'fox', also: [] }] };
  const session = createSettingsQuery(['project', 'one'], async () => { ++reads; return changed; }, first);
  const observer = new QueryObserver(session.client, session.options);
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => { unsubscribe(); session.dispose(); });
  assert.deepEqual(observer.getCurrentResult().data, first);
  assert.equal(reads, 0, 'opening an already filled page does not repeat the IPC request');
  await session.refresh();
  assert.equal(reads, 1);
  assert.deepEqual(session.client.getQueryData(session.options.queryKey), changed);
});
