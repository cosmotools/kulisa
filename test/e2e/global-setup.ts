// The local test site (fixtures/site.ts) on a free port, one for the run: the one npm test already started
// (KULISA_TEST_SITE), else its own. The workers read it from the environment (helpers.ts, SITE). The folders a run
// killed midway left (its worker gone, so its teardown never ran); a live worker's are another run's in this checkout.
// On Linux the keyring's key, before the workers' Kulisas start at once (keyring.ts).
import { spawnSync } from 'child_process';
import electronPath from 'electron';
import fs from 'fs';
import net from 'net';
import path from 'path';
import type { AddressInfo } from 'net';
import { ensureSite } from '../fixtures/site.ts';
import { removeTree } from '../../src/main/remove.ts';
import { BASE } from './helpers.ts';

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; } };

const freePort = () => new Promise<number>((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)); });
});

export default async function globalSetup() {
  for (const d of fs.existsSync(BASE) ? fs.readdirSync(BASE) : []) {
    const pid = Number(/-(\d+)-[0-9a-f]{6}$/.exec(d)?.[1]);
    if (!pid || !alive(pid)) try { removeTree(path.join(BASE, d)); } catch {} // Windows: a file still held; the next run tries again
  }
  if (process.platform === 'linux') {
    const made = spawnSync(electronPath as unknown as string, ['--no-sandbox', '--ozone-platform=headless', path.join(import.meta.dirname, 'keyring.ts')], { encoding: 'utf8', timeout: 60000 });
    if (made.status !== 0) throw new Error(`The keyring's key was not made (${made.status ?? made.signal}):\n${made.stderr}`);
  }
  if (process.env.KULISA_TEST_SITE) return;
  const site = await ensureSite(await freePort());
  process.env.KULISA_TEST_SITE = site.url;
  return () => { site.child?.kill(); };
}
