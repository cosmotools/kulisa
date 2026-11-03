// The welcome's generic coding CLI drawing (docs/ui.md, Own drawing). Familiar prompt, tool output and input
// conventions explain the user's own CLI; each transcript shares its active demonstration's CSS clock.
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
const CLI: Line[][] = [
  [
    { kind: 'tool', text: 'Read src/agent.ts' },
    { kind: 'tool', text: 'Edited src/agent.ts', change: true },
    { kind: 'text', text: 'I’ll run our CLI and try a coding task.' },
  ],
  [
    { kind: 'tool', text: 'Terminal › run "my-agent"' },
    { kind: 'result', text: 'Coding CLI ready · ~/demo-app' },
    { kind: 'tool', text: 'Terminal › type "Add a /health endpoint."' },
  ],
  [
    { kind: 'tool', text: 'Terminal › press Enter' },
    { kind: 'result', text: 'my-agent read src/server.ts' },
    { kind: 'text', text: 'Checking its file-editing tool…' },
  ],
  [
    { kind: 'tool', text: 'Terminal › inspect output' },
    { kind: 'result', text: 'src/server.ts updated · +1 line' },
    { kind: 'tool', text: 'Terminal › check /health response' },
  ],
  [
    { kind: 'result', text: '200 OK · {"ok":true}' },
    { kind: 'success', text: 'Our coding CLI completed the task.' },
    { kind: 'text', text: 'Ready to refine the next feature.' },
  ],
];

function TranscriptLine({ line, index }: { line: Line; index: number }) {
  return <p data-demo-motion className={`welcome-terminal-line welcome-terminal-line-${index} flex items-center gap-2 whitespace-nowrap ${line.kind === 'success' ? 'text-success' : line.kind === 'result' ? 'ps-3 text-muted-foreground' : 'text-foreground'}`}>
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
    <div role="img" aria-label={web ? 'Your chosen coding CLI edits checkout, tests Customer, then verifies the order as Admin' : 'Your chosen coding CLI builds and tests your own coding agent in another terminal'} className="px-4 pt-3 pb-2 font-mono text-[11px] leading-5">
      <div aria-hidden="true">
        <div className="flex gap-2 border-y bg-muted/50 px-2 py-1 text-foreground"><span className="text-muted-foreground">›</span><span>{web ? 'Build checkout. Check it as Customer and Admin.' : 'Build a coding CLI with file and shell tools.'}</span></div>
        <div className="relative mt-3 h-15 overflow-hidden">
          {(web ? WEB : CLI).map((lines, phase) => <div key={phase} data-demo-motion style={{ '--log-phase': phase } as CSSProperties} className="welcome-terminal-phase absolute inset-0">
            {lines.map((line, i) => <TranscriptLine key={line.text} line={line} index={i} />)}
          </div>)}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t pt-2 text-muted-foreground"><span className="text-foreground">›</span><span>Describe the next change</span><span data-demo-motion className="welcome-terminal-caret h-3.5 w-1.5 bg-muted-foreground" /></div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span data-demo-motion className="welcome-terminal-spinner inline-block">✳</span><span>Working…</span><span className="opacity-50">·</span>
          <span>esc to interrupt</span><span className="ms-auto truncate">{web ? '~/daylight' : '~/my-agent'} · {web ? 'checkout' : 'agent-tools'}</span>
        </div>
      </div>
    </div>
  </div>;
}
