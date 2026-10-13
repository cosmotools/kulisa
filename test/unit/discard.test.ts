// The rule for unloading a tab (discard.ts): off screen and unused long enough, and nothing that keeps a tab.
import { test } from 'node:test';
import assert from 'assert/strict';
import { shouldDiscard, DISCARD_AFTER } from '../../src/main/discard.ts';
import type { Facts } from '../../src/main/discard.ts';

const idle: Facts = { url: 'http://localhost:3000/cart', offScreenFor: DISCARD_AFTER, quietFor: DISCARD_AFTER, agentBusy: false,
  loading: false, dialog: false, devtools: false, audible: false, signinMode: false };

test('a tab is discarded once off screen and unused for the time, and never before', () => {
  assert.ok(shouldDiscard(idle));
  assert.ok(shouldDiscard({ ...idle, offScreenFor: 10 * DISCARD_AFTER, quietFor: 10 * DISCARD_AFTER }));
  assert.ok(!shouldDiscard({ ...idle, offScreenFor: DISCARD_AFTER - 1 }), 'looked at a moment ago');
  assert.ok(!shouldDiscard({ ...idle, quietFor: DISCARD_AFTER - 1 }), 'automation drove the profile a moment ago: an agent without hooks, a script');
  assert.ok(shouldDiscard({ ...idle, offScreenFor: 1000, quietFor: 1000 }, 1000), 'the time is a parameter (the tests)');
});

test("what keeps a tab: the agent working or waiting, a page loading, its dialog, its DevTools, sound, the human signing in, nothing to come back to", () => {
  assert.ok(!shouldDiscard({ ...idle, agentBusy: true }));
  assert.ok(!shouldDiscard({ ...idle, loading: true }));
  assert.ok(!shouldDiscard({ ...idle, dialog: true }));
  assert.ok(!shouldDiscard({ ...idle, devtools: true }));
  assert.ok(!shouldDiscard({ ...idle, audible: true }));
  assert.ok(!shouldDiscard({ ...idle, signinMode: true }));
  assert.ok(!shouldDiscard({ ...idle, url: '' }));
  assert.ok(!shouldDiscard({ ...idle, url: 'about:blank' }));
});
