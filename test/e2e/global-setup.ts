// The local test site (fixtures/site.ts) on a free port, one for the run: the one npm test already started
// (KULISA_TEST_SITE), else its own. The workers read it from the environment (helpers.ts, SITE).
import net from 'net';
import type { AddressInfo } from 'net';
import { ensureSite } from '../fixtures/site.ts';

const freePort = () => new Promise<number>((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)); });
});

export default async function globalSetup() {
  if (process.env.KULISA_TEST_SITE) return;
  const site = await ensureSite(await freePort());
  process.env.KULISA_TEST_SITE = site.url;
  return () => { site.child?.kill(); };
}
