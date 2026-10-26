// What the agent's e2e files (agent-*.spec.ts) share: the two profiles they act on, made through the core, and the
// window's actions as its page sends them.
import type { Page } from '@playwright/test';
import type { Core, Call } from './fixtures.ts';
import { SITE } from './helpers.ts';

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

// An action of the window as its page sends it (lib/store.ts, act: for the task shown), and a channel invoked as is.
// What they answer ({ error } when refused).
export const act = (ui: Page, channel: string, args: Record<string, unknown>) => ui.evaluate(([c, a]) => (window as any).act(c, a), [channel, args] as const);
export const invoke = (ui: Page, channel: string, args: Record<string, unknown>) => ui.evaluate(([c, a]) => (window as any).kulisa.invoke(c, a), [channel, args] as const);

// The tab a tool opened, by its answer.
export const opened = (r: { text: string }) => r.text.match(/Opened tab (\w+)/)[1];
