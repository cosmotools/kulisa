// The e2e tests on Playwright Test (docs/testing.md, End to end on Playwright Test): Kulisa started by test/e2e/fixtures.ts.
// On the CI a failed test runs once more: passing then, it is reported flaky, not hidden, and the job stays green.
import { defineConfig } from '@playwright/test';

const ci = !!process.env.CI;
export default defineConfig({
  testDir: 'test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  timeout: 30000,
  // A whole run stops by itself: nothing runs on unseen.
  globalTimeout: 20 * 60000,
  // One at a time: on macOS and Windows the Kulisas share one screen, and would take each other's focus.
  workers: 1,
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  outputDir: 'test-results',
  reporter: ci
    ? [['list'], ['github'], ['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
