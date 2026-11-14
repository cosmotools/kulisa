// Shadcn supplies the progress semantics; its indeterminate motion is configured by the caller.
import { Progress } from '@ui';
import './loading.css';

export function Loading() {
  return <div role="status" className="flex h-full items-center justify-center p-6
    [&_[data-slot=progress-indicator]]:flex-none [&_[data-slot=progress-indicator]]:w-2/5
    [&_[data-slot=progress-indicator]]:animate-[diff-loading_1.2s_ease-in-out_infinite]
    motion-reduce:[&_[data-slot=progress-indicator]]:animate-none
    motion-reduce:[&_[data-slot=progress-indicator]]:[transform:translateX(75%)]!">
    <div className="flex w-full max-w-64 flex-col gap-3">
      <span className="text-sm text-muted-foreground">Loading diff…</span>
      <Progress value={null} aria-label="Loading diff" />
    </div>
  </div>;
}
