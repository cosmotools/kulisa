// Shared optional search controls; engines supply their own search/navigation behavior (../README.md).
import type { ReactNode, Ref } from 'react';

export function FindBar({ query, onQuery, matches, active, truncated, onMove, inputRef, children }: {
  query: string; onQuery(query: string): void; matches: number; active: number; truncated?: boolean;
  onMove(step: number): void; inputRef: Ref<HTMLInputElement>; children?: ReactNode;
}) {
  return <div className="file-viewer-tools" role="search" aria-label="Find in file">
    <input ref={inputRef} type="search" aria-label="Find in file" placeholder="Find in file" value={query} maxLength={1000}
      onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); onMove(event.shiftKey ? -1 : 1); }
        if (event.key === 'Escape') onQuery('');
      }} />
    <span role="status" aria-label="Search results">{query ? `${active} / ${matches}${truncated ? '+' : ''}` : ''}</span>
    <button type="button" title="Previous match" aria-label="Previous match" disabled={!matches} onClick={() => onMove(-1)}>↑</button>
    <button type="button" title="Next match" aria-label="Next match" disabled={!matches} onClick={() => onMove(1)}>↓</button>
    {children}
  </div>;
}
