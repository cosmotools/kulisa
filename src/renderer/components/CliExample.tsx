// The welcome's CLI application drawing (docs/ui.md, Own drawing): the user's coding agent builds another coding
// agent, then operates it through a Stage terminal. The shared CSS clock keeps its keystrokes and output together.
import { useEffect, useRef } from 'react';
import { CheckIcon, SquareTerminalIcon } from 'lucide-react';
import { DemoAgent } from './DemoAgent';

const WIDTH = 960;

export function CliExample() {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) el.style.setProperty('--cli-scale', String(entry.contentRect.width / WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div className="p-3">
    <div role="img" aria-label="A coding agent you are building runs in a Stage terminal, receives a request to add a health endpoint, reads and edits a file, and checks the response" className="overflow-hidden rounded-lg border bg-background">
      <div aria-hidden="true">
        <div className="flex h-8 items-center gap-2 border-b bg-card px-3 text-xs"><SquareTerminalIcon className="size-3.5 text-muted-foreground" /><span className="font-medium">my-agent</span><span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">App you’re building</span><span className="ms-auto text-[10px] text-muted-foreground">Stage terminal</span></div>
        <div ref={viewport} className="relative aspect-[960/360] overflow-hidden [--cli-scale:0]">
          <div className="absolute top-0 left-0 h-90 w-240 origin-top-left scale-(--cli-scale) font-mono text-[14px] leading-6">
            <div data-demo-motion className="welcome-cli-launch absolute inset-0 p-6"><span className="text-muted-foreground">~/demo-app $ </span><span data-demo-motion className="welcome-cli-command inline-block align-bottom">my-agent</span></div>
            <div data-demo-motion className="welcome-cli-session flex h-full flex-col px-6 pt-4 pb-3">
              <div className="flex items-center gap-4 rounded-md border px-4 py-2"><SquareTerminalIcon className="size-5 text-muted-foreground" /><div><p className="font-semibold">my-agent <span className="font-normal text-muted-foreground">v0.1</span></p><p className="text-xs text-muted-foreground">Your coding agent · ~/demo-app</p></div></div>
              <div data-demo-motion className="welcome-cli-request mt-3 flex gap-3 border-y bg-muted/40 px-3 py-1"><span className="text-muted-foreground">›</span><span>Add a /health endpoint.</span></div>
              <div className="mt-2 flex flex-col">
                <p data-demo-motion className="welcome-cli-thinking text-muted-foreground">I’ll inspect the server and add the route.</p>
                <p data-demo-motion className="welcome-cli-read"><span className="text-muted-foreground">• </span>Read src/server.ts <span className="text-muted-foreground">· 42 lines</span></p>
                <div data-demo-motion className="welcome-cli-edit"><p><span className="text-muted-foreground">• </span>Edit src/server.ts <span className="text-success">+1</span></p><p className="ms-4 border-l border-success/40 bg-success/5 ps-3 text-success">+ app.get('/health', (_, res) =&gt; res.json({'{'} ok: true {'}'}));</p></div>
                <p data-demo-motion className="welcome-cli-run"><span className="text-muted-foreground">• </span>Run curl localhost:3000/health <span className="text-success">→ {'{'}"ok":true{'}'}</span></p>
                <p data-demo-motion className="welcome-cli-done text-success">✓ Added /health. The endpoint returns 200 OK.</p>
              </div>
              <div className="mt-auto flex h-9 items-center gap-3 border-y px-3"><span className="text-muted-foreground">›</span><div className="relative flex-1"><span data-demo-motion className="welcome-cli-input absolute top-0 left-0 w-max">Add a /health endpoint.</span><span data-demo-motion className="welcome-cli-placeholder text-muted-foreground">Ask my-agent to change your code</span></div><span data-demo-motion className="welcome-terminal-caret h-4 w-2 bg-muted-foreground" /></div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>~/demo-app</span><span>esc interrupt · enter send</span></div>
            </div>
          </div>
          <div data-demo-motion className="welcome-cli-agent pointer-events-none absolute top-0 left-0 z-20">
            <div className="-translate-x-3 -translate-y-9 text-destructive drop-shadow-md"><DemoAgent className="size-10" /><span className="absolute top-8 left-9 rounded-md bg-destructive px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">Agent</span><span data-demo-motion className="welcome-cli-enter absolute -top-1 left-10 whitespace-nowrap rounded border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground shadow-sm">Enter ↵</span></div>
          </div>
        </div>
        <div className="relative h-8 border-t px-3 text-[11px]"><span data-demo-motion className="welcome-cli-status-working absolute inset-0 flex items-center gap-1.5 px-3 text-warning"><span className="size-1.5 rounded-full bg-current" />Your agent is trying the coding CLI…</span><span data-demo-motion className="welcome-cli-status-done absolute inset-0 flex items-center gap-1.5 px-3"><CheckIcon className="size-3 text-success" />Your coding CLI read, edited and ran the code.</span></div>
      </div>
    </div>
  </div>;
}
