// A project's icon (docs/tasks.md, Projects): its site's favicon, or Kulisa's logo with its curtain in the project's
// color. The logo is the app icon's drawing (assets/icon.svg), its curtain in any color; its folds a shadow over it.
import { useId } from 'react';

export function Logo({ color, size = 16, ...rest }: { color: string; size?: number; 'data-testid'?: string }) {
  const id = useId(), folds = `${id}f`, body = `${id}b`;
  return <svg viewBox="100 100 824 824" width={size} height={size} aria-hidden="true" className="shrink-0" data-logo="" {...rest}>
    <defs>
      <linearGradient id={folds} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopOpacity=".4" /><stop offset=".3" stopOpacity="0" /><stop offset=".55" stopOpacity=".3" /><stop offset=".8" stopOpacity="0" /><stop offset="1" stopOpacity=".4" />
      </linearGradient>
      <clipPath id={body}><rect x="100" y="100" width="824" height="824" rx="185" /></clipPath>
    </defs>
    <g clipPath={`url(#${body})`}>
      <rect x="100" y="100" width="824" height="824" fill="#17181b" />
      {/* The color itself, not currentColor: a menu's row colors all in it as it is hovered. */}
      <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" style={{ fill: color }} />
      <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" style={{ fill: color }} />
      <path d="M100 100 H466 C438 390 374 630 318 924 H100 Z" fill={`url(#${folds})`} />
      <path d="M924 100 H558 C586 390 650 630 706 924 H924 Z" fill={`url(#${folds})`} />
    </g>
    <path d="M446 390 L446 740 L529 659 L584 777 L641 751 L586 635 L700 629 Z" fill="#ffd27a" stroke="#17181b" strokeWidth="26" strokeLinejoin="round" />
  </svg>;
}

// p.color: the color shown (lib/project-color.ts, projectColor: a favicon's own once read).
export function ProjectIcon({ p, size = 16 }: { p: { favicon?: string; color: string }; size?: number }) {
  return p.favicon ? <img data-testid="project-icon" src={p.favicon} alt="" width={size} height={size} className="shrink-0" />
    : <Logo data-testid="project-icon" color={p.color} size={size} />;
}
