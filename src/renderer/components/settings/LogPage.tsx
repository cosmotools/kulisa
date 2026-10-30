// The Log page of Settings (docs/window.md, The log): the log read whole and followed as it grows, filtered, passed on.
// Read as the page is shown, not as Settings opens (a megabyte for nothing otherwise), and let go as it is left.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, CircleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Label, Switch, ToggleGroup, ToggleGroupItem, Alert, AlertDescription } from '@ui';
import { ButtonMenu } from '../Menus';
import { Tip } from '../Tip';
import { refused } from '../../../shared/result';

// A line as the file has it: [date T time offset] [level] [tag …] the rest (log.ts, stamp; electron-log's local time with
// a space and no offset read too); a line not of that shape (an object's lines under an [electron] event) belongs to the
// one before it. The tag's group is the filter that shows it.
type Group = 'agent' | 'human' | 'tasks';
type Show = 'all' | 'errors' | Group;
interface Line { id: number; date: string; time: string; offset: string; level: string; tag: string; text: string; raw: string; group: Group | null; bad: boolean }
let nextLineId = 0;
const GROUPS: Record<string, Group> = { mcp: 'agent', hook: 'agent', terminal: 'agent', ipc: 'human', key: 'human', settings: 'human', task: 'tasks', window: 'tasks', kulisa: 'tasks' };
const SHOW: { id: Show; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every line' },
  { id: 'errors', label: 'Errors', hint: 'Warnings and errors: a page\'s, Electron\'s, an action refused or failed' },
  { id: 'agent', label: 'Agent', hint: 'What the agent did: its tools, its hooks, its terminal' },
  { id: 'human', label: 'Human', hint: 'What you did: a window\'s messages, keys, Settings' },
  { id: 'tasks', label: 'Tasks', hint: 'Tasks and windows opened and closed, the start' }];
// Who acted, in the theme's colors: the agent's, the human's, the tasks'; a line in trouble in the error's.
const TAG: Record<Group, string> = { agent: 'text-success', human: 'text-warning', tasks: 'text-foreground' };
const LINE = /^\[(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d\.\d{3})([+-]\d\d:\d\d|Z)?\] \[(\w+)\]\s*(?:\[(\w+)[^\]]*\]\s?)?(.*)$/;
const isBad = (level: string, tag: string, text: string) => level === 'warn' || level === 'error' || tag === 'page' || tag === 'electron' || /\b(refused|failed)\b/.test(text);

// The file's text into lines, added to `into`; a line's beginning whose end has not come yet waits in `rest`.
function parse(text: string, into: Line[], rest: { text: string }) {
  const parts = (rest.text + text).split('\n');
  rest.text = parts.pop()!;
  for (const raw of parts.map((p) => p.replace(/\r$/, ''))) {
    const m = LINE.exec(raw), last = into.length - 1;
    if (m) {
      const [, date, time, offset = '', level, tag = '', body] = m as unknown as string[];
      into.push({ id: nextLineId++, date: date!, time: time!, offset, level: level!, tag, text: body!, raw, group: GROUPS[tag] ?? null, bad: isBad(level!, tag, body!) });
    } else if (last >= 0) {
      const l = into[last]!, body = `${l.text}\n${raw}`;
      into[last] = { ...l, text: body, raw: `${l.raw}\n${raw}`, bad: isBad(l.level, l.tag, body) };
    }
  }
}

// What the main process sends as the log grows comes to the page shown, if any (kulisa.on has no way to stop listening).
let onLines: ((m: { text: string } | { reset: true }) => void) | null = null;
kulisa.on('log:lines', (m) => onLines?.(m));

// data-tag, data-group, data-bad: the tests' handles on a line's kind.
const Row = memo(function Row({ l }: { l: Line }) {
  return <div data-tag={l.tag || undefined} data-group={l.group ?? undefined} data-bad={l.bad || undefined} title={`${l.date} ${l.offset}`.trim()}
    className={`grid grid-cols-[auto_auto_1fr] gap-x-2 whitespace-pre-wrap [overflow-wrap:anywhere] ${l.bad ? 'text-destructive' : ''}`}>
    <span className="text-muted-foreground tabular-nums">{l.time}</span>
    <span className={`font-semibold ${l.bad ? '' : l.group ? TAG[l.group] : 'text-muted-foreground'}`}>{l.tag && `[${l.tag}]`}</span>
    <span>{l.text}</span>
  </div>;
});

export function LogPage() {
  const [lines, setLines] = useState<Line[] | null>(null), [info, setInfo] = useState({ size: 0, max: 0, old: null as string | null });
  const [show, setShow] = useState<Show>('all'), [filter, setFilter] = useState(''), [follow, setFollow] = useState(true);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null), followId = useId();

  // Read whole, then followed: what comes before the answer is what this read has already (log.ts, readLog).
  useEffect(() => {
    let loaded = false, live = true;
    const rest = { text: '' };
    const load = async () => {
      loaded = false;
      const r = await kulisa.invoke('log:get');
      if (!live) return;
      const all: Line[] = [];
      rest.text = ''; parse(r.text, all, rest);
      setLines(all); setInfo({ size: r.size, max: r.max, old: r.old }); loaded = true;
    };
    onLines = (m) => {
      if (!loaded) return;
      if ('reset' in m) { void load(); return; }
      setLines((now) => { const next = [...(now ?? [])]; parse(m.text, next, rest); return next; });
      setInfo((i) => ({ ...i, size: i.size + new TextEncoder().encode(m.text).length }));
    };
    void load();
    return () => { live = false; onLines = null; };
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (lines ?? []).filter((l) => (show === 'all' || (show === 'errors' ? l.bad : l.group === show)) && (!q || l.raw.toLowerCase().includes(q)));
  }, [lines, show, filter]);
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => box.current,
    estimateSize: () => 20,
    getItemKey: useCallback((i: number) => shown[i]!.id, [shown]),
    overscan: 8,
    directDomUpdates: true,
    paddingStart: 6,
    paddingEnd: 6,
    anchorTo: 'end',
    followOnAppend: follow,
    scrollEndThreshold: 4,
    onChange: (v, scrolling) => {
      if (scrolling && v.scrollDirection === 'backward' && !v.isAtEnd()) setFollow(false);
    },
  });
  useLayoutEffect(() => { virtualizer.scrollToOffset(0); }, [show, filter, virtualizer]);
  useLayoutEffect(() => { if (follow && shown.length) virtualizer.scrollToEnd(); }, [shown, follow, virtualizer]);

  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  const copy = async () => { await navigator.clipboard.writeText((lines ?? []).map((l) => l.raw).join('\n')); setError(''); toast.success('Copied'); };
  const save = async () => {
    const r = await kulisa.invoke('log:save');
    setError(refused(r) ? r.error : '');
    const file = !refused(r) && r.file;
    if (file) toast.success(`Saved as ${file}`, { action: { label: 'Show in Folder', onClick: () => void kulisa.invoke('file:show', file) } });
  };

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <Input type="search" className="w-64" value={filter} placeholder="Filter: a task, wc=1, [mcp]…" aria-label="Filter" spellCheck={false}
        onChange={(e) => setFilter(e.target.value)} />
      <ToggleGroup type="single" size="sm" aria-label="Show" value={show} onValueChange={(v) => { if (v) setShow(v as Show); }}>
        {/* the tip on a box around the item: as its trigger, the tooltip's data-state would take the place of the item's */}
        {SHOW.map((s) => <Tip key={s.id} text={s.hint}><span><ToggleGroupItem value={s.id}>{s.label}</ToggleGroupItem></span></Tip>)}
      </ToggleGroup>
      <div className="ms-auto flex items-center gap-2">
        <Switch id={followId} checked={follow} onCheckedChange={setFollow} />
        <Label htmlFor={followId}>Follow</Label>
      </div>
    </div>
    <div ref={box} role="log" aria-label="Log" data-selectable
      onWheel={() => virtualizer.cancelScroll()} onPointerDown={() => virtualizer.cancelScroll()} onKeyDown={() => virtualizer.cancelScroll()}
      className="min-h-0 flex-1 cursor-text overflow-auto rounded-lg border bg-card px-2 font-mono text-xs leading-5 text-card-foreground [overflow-anchor:none]">
      <div ref={virtualizer.containerRef} className="relative w-full">
        {virtualizer.getVirtualItems().map((v) => <div key={v.key} data-index={v.index} ref={virtualizer.measureElement}
          className="absolute left-0 top-0 w-full">
          <Row l={shown[v.index]!} />
        </div>)}
      </div>
      {lines && !shown.length && <p className="py-1.5 text-muted-foreground">Nothing matches.</p>}
    </div>
    <p className="text-xs text-muted-foreground">
      kulisa.log, {kb(info.size)} of {Math.round(info.max / 1024 / 1024)} MB{info.old ? `; kulisa.old.log from ${info.old.slice(0, 10)}` : ''}. Never here: what you typed,
      passwords, tokens, cookies, the pages' queries.
    </p>
    {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{error}</span></AlertDescription></Alert>}
    <div className="flex items-center justify-end gap-2">
      <Tip text="The whole log, to paste anywhere"><Button variant="outline" onClick={() => void copy()}>Copy All</Button></Tip>
      <Tip text="The log as a file, to attach to a message or an issue"><Button variant="outline" onClick={() => void save()}>Save As…</Button></Tip>
      <Tip text="Its folder in your file manager"><Button variant="outline" onClick={() => void kulisa.invoke('log:show-folder')}>Open Folder</Button></Tip>
      <ButtonMenu end items={() => [{ label: 'On GitHub…', sub: 'a public issue, the environment filled in; attach the saved log', run: () => kulisa.invoke('log:report') }]}>
        <Button>Report…<ChevronDownIcon data-icon="inline-end" /></Button>
      </ButtonMenu>
    </div>
  </div>;
}
