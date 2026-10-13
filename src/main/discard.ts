// Tabs no one looks at lose their process after a while, as Chrome's Memory Saver discards tabs, and come back when
// looked at or used (docs/profiles.md, "Tabs unloaded"). Here the rule (shouldDiscard) and the sweep that applies it
// to every loaded task; the mechanics are the tab's (Profile.discard, load).
import type { Shell } from './shell.ts';
import type { Task } from './tasks.ts';
import type { Profile, Tab } from './profiles.ts';

// Off screen, and no automation on the profile, for this long: 5 minutes (the author, 2026-10-13). Switching tasks
// back and forth within it reloads nothing.
const DISCARD_AFTER = 5 * 60_000;
const SWEEP_EVERY = 30_000;

// What decides a tab's fate, read off the tab, its profile and its task (facts, below).
interface Facts {
  url: string; // where it would come back; none: nothing to keep (about:blank)
  offScreenFor: number; // since the sweep first saw it off screen (not the active tab of a pane on screen in the shown task)
  quietFor: number; // since automation last sent its profile a command (cdp-proxy.ts): agents without hooks, other clients
  agentBusy: boolean; // an agent of the task working, or waiting for the human to go on (its hooks)
  loading: boolean; dialog: boolean; devtools: boolean; audible: boolean; signinMode: boolean;
}
function shouldDiscard(f: Facts, after = DISCARD_AFTER) {
  return !!f.url && f.url !== 'about:blank' && !f.signinMode && !f.agentBusy && !f.loading && !f.dialog && !f.devtools && !f.audible
    && f.offScreenFor >= after && f.quietFor >= after;
}

interface Discarder { after: number; sweep(now?: number): number; stop(): void }

// Every tab of every loaded task weighed (now: the time, the tests' to set); how many were discarded. A tab seen off
// screen is dated then (offScreenSince), and undated once it is looked at again: the sweep's own clock, so no place
// that shows or hides a tab has to tell it.
function startDiscarding(shell: Shell): Discarder {
  const self: Discarder = {
    after: DISCARD_AFTER,
    sweep(now = Date.now()) {
      let n = 0;
      for (const project of shell.open.values()) for (const task of project.tasks.values()) {
        if (!task.loaded) continue;
        const busy = task.agentTerminals().some((t) => t.state === 'working' || t.state === 'waiting');
        for (const p of task.profiles.values()) for (const tab of p.tabs) {
          if (tab.discarded || tab.wc.isDestroyed()) continue;
          const onScreen = task.shown() && p.shown && tab.id === p.active;
          if (onScreen) { tab.offScreenSince = undefined; continue; }
          tab.offScreenSince ??= now;
          if (shouldDiscard(facts(task, p, tab, busy, now), self.after)) { p.discard(tab, task.urlOf(tab)); n++; }
        }
      }
      return n;
    },
    stop() { clearInterval(timer); },
  };
  const timer = setInterval(() => { try { self.sweep(); } catch (e) { console.error('[discard]', (e as Error).message); } }, SWEEP_EVERY);
  return self;
}
function facts(task: Task, p: Profile, tab: Tab, agentBusy: boolean, now: number): Facts {
  return {
    url: task.urlOf(tab), offScreenFor: now - (tab.offScreenSince ?? now), quietFor: now - p.busyAt, agentBusy,
    loading: tab.loading || !!tab.pendingUrl, dialog: !!tab.dialog, devtools: tab.wc.isDevToolsOpened(), audible: tab.wc.isCurrentlyAudible(), signinMode: p.signinMode,
  };
}

export type { Discarder, Facts };
export { shouldDiscard, startDiscarding, DISCARD_AFTER };
