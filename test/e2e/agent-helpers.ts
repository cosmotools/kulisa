// What the agent's e2e files share: the two profiles the agent's tools act on (agent-*.spec.ts), made through the core;
// the fake agent CLI as its installer leaves it (app.ts).
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import type { Core, Call } from './fixtures.ts';
import type { data } from './data.ts';
import { SITE, WIN, invoke } from './helpers.ts';

type Files = ReturnType<typeof data>;

// Sam.seller (the fox, "seller in the test shop") and Elon.buyer (the penguin, who it is not said), open in the shown
// task, laid out, each its one tab in front on the app's page: what the agent's tests start from (making profiles is
// tested in agent-profiles.spec.ts). Their ids, by which the window knows them.
export const profiles = (core: Core) => core(async (k, url) => {
  const t = k.shell.task, ids: string[] = [];
  for (const [name, description, avatar] of [['Sam.seller', 'seller in the test shop', 'fox'], ['Elon.buyer', '', 'penguin']]) {
    const named = (n: string) => n.toLowerCase() === name.toLowerCase();
    const closed = [...t.closed.values()].find((c) => named(c.cfg.name));
    if (closed) await t.openProfile(closed.cfg.id);
    else if (![...k.shell.profiles.values()].some((p) => named(p.name))) await t.createProfile(name, description, avatar);
    const p = k.profile(name);
    if (p.description !== description) t.describeProfile(p.id, description);
    if (p.avatar !== avatar) t.setProfileAvatar(p.id, avatar);
    for (const tab of p.tabs.slice(1)) p.closeTab(tab.id);
    await k.ensureProfile(name, url);
    ids.push(p.id);
  }
  return { sam: ids[0], elon: ids[1] };
}, `${SITE}/app`);

// Signed in to the test site, as the agent does it (its sign-in page sets the cookie).
export const signIn = (call: Call, profile: string, name: string) => call('browser_navigate', { profile, url: `${SITE}/app/login?name=${name}` });

// The tab a tool opened, by its answer.
export const opened = (r: { text: string }) => r.text.match(/Opened tab (\w+)/)[1];

// The fake agent's program once installed (app.ts): on Windows its .cmd, which Kulisa finds and runs.
export const fakeBin = (files: Files) => path.join(files.root, 'bin', WIN ? 'kulisa-fake-agent.cmd' : 'kulisa-fake-agent');
// The fake agent installed (or not), as its installer leaves it: the program in the test's bin, on Windows a .cmd running
// it with bash (installing is tested in Settings → Agents); looked for again.
export async function fakeAgent(ui: Page, files: Files, installed = true) {
  const bin = path.join(files.root, 'bin'), program = path.join(bin, 'kulisa-fake-agent');
  if (installed && !fs.existsSync(fakeBin(files))) {
    fs.mkdirSync(bin, { recursive: true });
    fs.copyFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'fake-agent.sh'), program);
    fs.chmodSync(program, 0o755);
    if (WIN) fs.writeFileSync(`${program}.cmd`, '@bash "%~dp0kulisa-fake-agent" %*');
  }
  if (!installed) for (const f of [program, `${program}.cmd`]) fs.rmSync(f, { force: true });
  await invoke(ui, 'agents:list', { details: true, cached: false });
}
