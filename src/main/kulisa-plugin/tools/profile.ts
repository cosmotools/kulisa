// The agent's tools on the profiles as things: list, open, close, create, rename, describe, remove, sign-ins. How a
// tool is designed: ../CLAUDE.md.
import { z } from 'zod';
import { refused } from '../../../shared/result.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Handles } from './handles.ts';

// profile_ask_signin's requests per profile ('<task key>/<profile id>'): { at, page, wentIn }, kept across calls.
const signinAsks = new Map<string, { at: number; page: string; wentIn: boolean }>();
const pageKey = (u: string) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } };

function profileTools(server: McpServer, { task, profileArg, text, done, idOf, pageOf }: Handles) {
  // description: who the profile is (the human's words), or not said; avatar: its picture, which the human knows the
  // pane by ("the fox").
  server.registerTool('profile_list', { description: 'List profiles: name (by which the tools take a profile), description (who it is in the app; null: not said, ask the human), picture (avatar), whether the human is signing in (signinMode), tabs; closed ones (closed: true) need profile_open first.', inputSchema: {} },
    async () => text(JSON.stringify([
      ...[...task.profiles.values()].map(({ name, description, avatar, login, hasPassword, signinMode, active, tabs }) =>
        ({ name, description: description || null, avatar, ...(login && { testLogin: login, testPassword: hasPassword }), signinMode, active,
          tabs: tabs.filter((t) => t.discarded || !t.wc.isDestroyed()).map((t) => ({ id: t.id, title: t.title, url: t.url })) })),
      ...[...task.closed.values()].map(({ cfg, tabs }) => ({ name: cfg.name, description: cfg.description || null, avatar: cfg.avatar,
        ...(cfg.login && { testLogin: cfg.login, testPassword: cfg.hasPassword }),
        closed: true, tabs: tabs.urls.length })),
    ], null, 1)));

  server.registerTool('profile_open', {
    description: 'Open a closed profile: its pane comes back with its tabs, still signed in. Costs memory: open one only when the task needs it.',
    inputSchema: { profile: z.string().describe('The name of a closed profile (profile_list)') },
  }, async ({ profile }) => {
    const id = idOf(profile);
    done(await task.openProfile(id));
    const page = await pageOf(profile); // its active tab loaded, for the next snapshot
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return text(`Profile ${profile} is open, with ${task.profiles.get(id)!.tabs.length} tab(s); active: ${page.url()}`);
  });
  server.registerTool('profile_close', {
    description: "Close a profile: its pane and tabs go and free their memory; it stays signed in, and profile_open brings it back with the same tabs. Close profiles you opened when you are done with them, others only when the human asks.",
    inputSchema: { profile: z.string().describe('The name of an open profile') },
  }, async ({ profile }) => {
    done(await task.closeProfile(idOf(profile)));
    return text(`Closed profile ${profile}; it is still signed in.`);
  });
  server.registerTool('profile_delete', {
    description: "Remove a profile from this project: its copies in the project's tasks go (their tabs, and what was signed in only there); the profile itself stays, with its sign-ins, in Kulisa's Settings → Profiles, where only the human deletes profiles. The human is asked to confirm. Only when the human asks, or a profile you created is no longer needed.",
    inputSchema: { profile: z.string().describe("The profile's name, open or closed") },
  }, async ({ profile }) => {
    done(await task.deleteProfile(idOf(profile), 'agent'));
    return text(`Removed profile ${profile} from the project; it stays in Settings → Profiles.`);
  });

  server.registerTool('profile_create', {
    description: 'Create a new, empty profile (a separate browser profile with its own pane) for a user the task needs and no profile has. The human then signs it in by hand. Costs memory: reuse a profile when one fits.',
    inputSchema: {
      name: z.string().describe('Who this profile is: letters, digits and @ . _ + - only, e.g. "ann@shop.com" (the account it signs in to) or "ann.admin"; no other profile of the project has it, whatever its case'),
      description: z.string().optional().describe('As in profile_describe: only what the human said'),
    },
  }, async ({ name, description }) => {
    done(await task.createProfile(name, description));
    return text(`Created profile ${name.trim()}. It is signed out: ask the human to sign it in (profile_ask_signin).`);
  });

  server.registerTool('profile_rename', {
    description: 'Rename a profile, e.g. after the human signed it in to another account. The tools take it by its new name from then on.',
    inputSchema: { profile: profileArg, name: z.string().describe('As in profile_create') },
  }, async ({ profile, name }) => {
    done(task.renameProfile(idOf(profile), name));
    return text(`Renamed ${profile} to ${name.trim()}.`);
  });

  server.registerTool('profile_describe', {
    description: "Save who a profile is in the app under test (its role, what it can do), which agents choose profiles by. Only the human's words: when no description tells which profile a task means, ask the human, then save their answer. An empty description clears it.",
    inputSchema: { profile: profileArg, description: z.string().describe('e.g. "seller in the Acme shop; can approve refunds"') },
  }, async ({ profile, description }) => {
    done(task.describeProfile(idOf(profile), description));
    return text(description.trim() ? `Saved: ${profile} is "${description.trim()}".` : `Cleared ${profile}'s description.`);
  });

  // The human signs in, never the agent (CLAUDE.md, Rules): it asks, the pane shows the request, and this waits until
  // the human is through: the profile went through sign-in mode (signin-pause.ts) and left it, or its page is no
  // longer the one it was asked on. Where it was asked is kept across calls, so waiting again goes on from there.
  server.registerTool('profile_ask_signin', {
    description: 'Ask the human to sign a profile in, and wait until they have; the request shows over its pane. ' +
      "url: the app's sign-in page, opened first. Up to 45 s a call; \"not yet\": call again to keep waiting. Then check with browser_snapshot.",
    inputSchema: { profile: profileArg, url: z.string().optional(), why: z.string().optional().describe('A few words: as whom, for what') },
  }, async ({ profile, url, why }) => {
    const r = task.find(idOf(profile));
    if (refused(r)) throw new Error(r.error);
    const p = r.profile, key = `${task.key}/${p.id}`;
    let ask = signinAsks.get(key);
    if (!ask || Date.now() - ask.at > 10 * 60_000) {
      if (url) {
        // The window's way, not Playwright's: a sign-in page puts the profile in sign-in mode, which cuts Playwright off.
        const wc = p.get()!.wc;
        p.navigate(undefined, url);
        await new Promise<void>((ok) => { wc.once('did-stop-loading', () => ok()); setTimeout(ok, 10_000); });
      }
      ask = { at: Date.now(), page: pageKey(p.get()!.wc.getURL()), wentIn: p.signinMode };
      signinAsks.set(key, ask);
    }
    task.caption(p.id, `sign in, please${why ? `: ${why}` : ''}`, true);
    for (const until = Date.now() + 45_000; Date.now() < until; await new Promise((ok) => setTimeout(ok, 300))) {
      if (p.deleted) throw new Error(`Profile ${profile} was deleted.`);
      if (p.signinMode || p.resuming) { ask.wentIn = true; continue; }
      if (ask.wentIn || pageKey(p.get()!.wc.getURL()) !== ask.page) {
        signinAsks.delete(key);
        task.caption(p.id, '');
        return text(`The human is through: ${profile} is at ${p.get()!.wc.getURL()}. Check with browser_snapshot that it is signed in.`);
      }
    }
    return text(`Not yet: ${profile} is still at ${p.get()!.wc.getURL()}. Call profile_ask_signin again to keep waiting, or go on with something else.`);
  });

  server.registerTool('profile_set_login', {
    description: "Save a test user's login-password pair for a profile, e.g. after you signed that user up in the app under test, so you (and later tasks) sign in with browser_type_login. Only for test users of the app on this computer: never a real account's password.",
    inputSchema: { profile: profileArg, login: z.string().describe('The user name or email'), password: z.string() },
  }, async ({ profile, login, password }) => {
    done(task.setLogin(idOf(profile), login, password));
    return text(`Saved ${profile}'s test login ${login.trim()}; its password is kept encrypted.`);
  });
}

export { profileTools };
