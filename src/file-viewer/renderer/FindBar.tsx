// Shared optional search controls; engines supply their own search/navigation behavior (../README.md).
import type { ReactNode, Ref } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, Input } from '@ui';

export function FindBar({ query, onQuery, matches, active, truncated, onMove, inputRef, children, disabled }: {
  query: string; onQuery(query: string): void; matches: number; active: number; truncated?: boolean;
  onMove(step: number): void; inputRef: Ref<HTMLInputElement>; children?: ReactNode; disabled?: boolean;
}) {
  return <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1 text-xs" role="search" aria-label="Find in file">
    <Input ref={inputRef} disabled={disabled} className="h-7 min-w-15 max-w-60 flex-1" type="search" aria-label="Find in file" placeholder="Find in file" value={query} maxLength={1000}
      onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); onMove(event.shiftKey ? -1 : 1); }
        if (event.key === 'Escape') onQuery('');
      }} />
    <span role="status" aria-label="Search results">{query ? `${active} / ${matches}${truncated ? '+' : ''}` : ''}</span>
    <Button type="button" variant="ghost" size="icon-sm" title="Previous match" aria-label="Previous match" disabled={!matches} onClick={() => onMove(-1)}><ArrowUp /></Button>
    <Button type="button" variant="ghost" size="icon-sm" title="Next match" aria-label="Next match" disabled={!matches} onClick={() => onMove(1)}><ArrowDown /></Button>
    {children}
  </div>;
}
