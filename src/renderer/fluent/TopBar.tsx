// The title bar (docs/window.md, The title bar). The shell: its row, with what is put in it (the tasks' bar on top).
import type { ReactNode } from 'react';

export function TopBar({ children }: { children?: ReactNode }) {
  return <header style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', WebkitAppRegion: 'drag' } as React.CSSProperties}>
    <span style={{ fontWeight: 600 }}>Kulisa</span>{children}
  </header>;
}
