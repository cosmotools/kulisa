// The welcome's generic coding CLI drawing (docs/ui.md, Own drawing). Familiar prompt, tool output and input
// conventions explain the user's own CLI; the web transcript shares the browser demonstration's CSS clock.
import type { CSSProperties, ReactNode } from 'react';
import { SquareTerminalIcon } from 'lucide-react';

type Line = { kind: 'tool' | 'result' | 'text' | 'success'; text: string; change?: boolean };
const WEB: Line[][] = [
  [
    { kind: 'tool', text: 'Read src/checkout.tsx' },
    { kind: 'tool', text: 'Edited src/checkout.tsx', change: true },
    { kind: 'text', text: 'I’ll check checkout in both profiles.' },
  ],
  [
    { kind: 'tool', text: 'Browser(Customer) › click "Add to bag"' },
    { kind: 'result', text: 'Everyday tote · Natural · $24' },
    { kind: 'tool', text: 'Browser(Customer) › place order' },
  ],
  [
    { kind: 'result', text: 'Order #1042 confirmed · $24' },
    { kind: 'text', text: 'I’ll verify the same order as Admin.' },
    { kind: 'tool', text: 'Browser(Admin) › open orders' },
  ],
  [
    { kind: 'tool', text: 'Browser(Admin) › refresh orders' },
    { kind: 'result', text: 'Found #1042 · Everyday tote · $24' },
    { kind: 'tool', text: 'Browser(Admin) › open order #1042' },
  ],
  [
    { kind: 'text', text: 'Product, quantity and total match.' },
    { kind: 'success', text: 'Checkout verified in both profiles.' },
    { kind: 'text', text: 'Ready for your next change.' },
  ],
];
const CLI: Line[] = [
  { kind: 'tool', text: 'Edited src/menu.tsx', change: true },
  { kind: 'tool', text: 'Terminal › press ArrowDown, Enter' },
  { kind: 'success', text: 'Menu navigation opens the selected screen.' },
];

function TranscriptLine({ line, index, animated }: { line: Line; index: number; animated: boolean }) {
  return <p data-demo-motion={animated || undefined} className={`${animated ? `welcome-terminal-line welcome-terminal-line-${index} ` : ''}flex items-center gap-2 whitespace-nowrap ${line.kind === 'success' ? 'text-success' : line.kind === 'result' ? 'ps-3 text-muted-foreground' : 'text-foreground'}`}>
    <span className={line.kind === 'text' ? 'invisible' : 'text-muted-foreground'}>{line.kind === 'result' ? '└' : line.kind === 'success' ? '✓' : '•'}</span>
    <span>{line.text}</span>{line.change && <span className="text-muted-foreground">(<span className="text-success">+18</span> <span className="text-destructive">−4</span>)</span>}
  </p>;
}

export function AgentTerminal({ web, controls }: { web: boolean; controls?: ReactNode }) {
  return <div className="min-w-0 border-t bg-background">
    <div className="flex h-9 items-center gap-2 border-b bg-card px-4 text-xs">
      <SquareTerminalIcon className="size-3.5 shrink-0 text-muted-foreground" /><span className="shrink-0">Your agent’s terminal</span>
      <span className="ms-auto truncate text-[10px] text-muted-foreground">Claude Code · Codex · your CLI</span>{controls}
    </div>
    <div role="img" aria-label={web ? 'Your chosen coding CLI edits checkout, tests Customer, then verifies the order as Admin' : 'Your chosen coding CLI edits and checks the terminal app'} className="px-4 pt-3 pb-2 font-mono text-[11px] leading-5">
      <div aria-hidden="true">
        <div className="flex gap-2 border-y bg-muted/50 px-2 py-1 text-foreground"><span className="text-muted-foreground">›</span><span>{web ? 'Build checkout. Check it as Customer and Admin.' : 'Add keyboard navigation to the task menu.'}</span></div>
        <div className="relative mt-3 h-15 overflow-hidden">
          {web ? WEB.map((lines, phase) => <div key={phase} data-demo-motion style={{ '--log-phase': phase } as CSSProperties} className="welcome-terminal-phase absolute inset-0">
            {lines.map((line, i) => <TranscriptLine key={line.text} line={line} index={i} animated />)}
          </div>) : CLI.map((line, i) => <TranscriptLine key={line.text} line={line} index={i} animated={false} />)}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t pt-2 text-muted-foreground"><span className="text-foreground">›</span><span>Describe the next change</span><span data-demo-motion={web || undefined} className={`${web ? 'welcome-terminal-caret ' : ''}h-3.5 w-1.5 bg-muted-foreground`} /></div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          {web && <><span data-demo-motion className="welcome-terminal-spinner inline-block">✳</span><span>Working…</span><span className="opacity-50">·</span></>}
          <span>esc to interrupt</span><span className="ms-auto truncate">~/daylight · {web ? 'checkout' : 'keyboard-nav'}</span>
        </div>
      </div>
    </div>
  </div>;
}
