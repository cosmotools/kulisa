// Shared welcome character (docs/ui.md, Own drawing); its eyes follow the active example’s CSS clock.
// A curtain-shaped body and two feet give Kulisa its own character without borrowing an agent's brand.
export function DemoAgent({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
    <path d="M14 35 12 42M34 35l2 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M8 13Q24 3 40 13V35Q35 31 30 35Q24 31 18 35Q13 31 8 35Z" fill="currentColor" />
    <path d="M12 13Q24 6 36 13" stroke="var(--primary-foreground)" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
    <rect x="15" y="17" width="18" height="11" rx="5.5" fill="var(--background)" />
    <g data-demo-motion className="welcome-agent-eyes" fill="var(--foreground)"><rect x="19" y="20" width="3" height="5" rx="1.5" /><rect x="26" y="20" width="3" height="5" rx="1.5" /></g>
    <path d="m7 23-4 3m38-3 4 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
