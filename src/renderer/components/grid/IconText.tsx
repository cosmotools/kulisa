// A button's inside in the grid's panels: its icon, its name and a muted line under it, each cut with … (big: the
// terminals' launchers).
import type { ReactNode } from 'react';

export function IconText({ icon, name, line, big }: { icon: ReactNode; name: string; line?: string; big?: boolean }) {
  return <span className={`flex min-w-0 items-center ${big ? 'gap-3 py-3' : 'gap-1.5 py-1'}`}>
    {icon}
    <span className="flex min-w-0 flex-col items-start">
      <span className="max-w-full truncate">{name}</span>
      {line && <span className="max-w-full truncate text-xs font-normal text-muted-foreground">{line}</span>}
    </span>
  </span>;
}
