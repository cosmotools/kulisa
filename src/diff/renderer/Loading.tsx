// Shadcn supplies the progress semantics; its indeterminate motion is configured by the caller.
import { Progress } from '@ui';
import './loading.css';

export function Loading() {
  return <div role="status" className="diff-loading flex h-full items-center justify-center p-6">
    <div className="flex w-full max-w-64 flex-col gap-3">
      <span className="text-sm text-muted-foreground">Loading diff…</span>
      <Progress value={null} aria-label="Loading diff" />
    </div>
  </div>;
}
