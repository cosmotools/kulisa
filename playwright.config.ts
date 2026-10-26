// The e2e tests on Playwright Test (docs/testing.md, End to end): Kulisa started by test/e2e/fixtures.ts.
// On the CI a failed test runs once more: passing then, it is reported flaky, not hidden, and the job stays green.
import os from 'os';
import { defineConfig } from '@playwright/test';

const ci = !!process.env.CI;
// Several Kulisas at once on Linux, each on a screen of its own: as many as half the cores and the free memory allow
// (a test Kulisa takes up to 1.5 GB), at most 4. One on macOS and Windows, and on the human's screen (KULISA_VISIBLE):
// one screen and one focus, which two Kulisas would take from each other (docs/testing.md, Speed). --workers overrides.
const KULISA_MB = 1500;
const workers = process.platform !== 'linux' || process.env.KULISA_VISIBLE ? 1
  : Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 2), Math.floor(os.freemem() / 2 ** 20 / KULISA_MB)));
export default defineConfig({
  testDir: 'test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  timeout: 30000,
  // A whole run stops by itself: nothing runs on unseen.
  globalTimeout: 20 * 60000,
  workers,
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  outputDir: 'test-results',
  // On the CI a shard's report is a blob, merged with the others' into the HTML and JUnit (test.yml, test).
  reporter: ci ? [['list'], ['github'], ['blob']] : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
