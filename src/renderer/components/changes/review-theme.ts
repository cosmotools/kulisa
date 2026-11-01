// The review's palette and shared highlighting worker (docs/ui.md).
import { registerCustomCSSVariableTheme } from '@pierre/diffs';
import ReviewWorker from '@pierre/diffs/worker/worker.js?worker';

registerCustomCSSVariableTheme('kulisa-review', {
  foreground: 'var(--foreground)', background: 'var(--card)',
  'token-comment': 'var(--muted-foreground)', 'token-keyword': 'var(--primary)',
  'token-string': 'var(--chart-2)', 'token-string-expression': 'var(--chart-2)',
  'token-constant': 'var(--chart-3)', 'token-function': 'var(--chart-1)',
  'token-parameter': 'var(--foreground)', 'token-punctuation': 'var(--muted-foreground)',
  'token-link': 'var(--primary)', 'token-inserted': 'var(--success)', 'token-deleted': 'var(--destructive)',
});
export const poolOptions = { workerFactory: () => new ReviewWorker(), poolSize: 1, totalASTLRUCacheSize: 4 };
export const highlighterOptions = { theme: 'kulisa-review', maxLineDiffLength: 1000, tokenizeMaxLineLength: 1000 };
