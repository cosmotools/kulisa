// The Log page of Settings (docs/window.md, The log): the log read whole and followed as it grows, filtered, passed on.
// Read as the page is shown, not as Settings opens (a megabyte for nothing otherwise), and let go as it is left.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Button, Caption1, Link, MenuButton, SearchBox, Switch, Text, Toast, Toaster, ToastTitle, Toolbar,
  ToolbarRadioButton, ToolbarRadioGroup, Tooltip, useId, useToastController } from '@fluentui/react-components';
import { ButtonMenu } from '../Menus';
import { refused } from '../../../shared/result';
import css from './LogPage.module.css';
import { ErrorBar } from '../ErrorBar';

// A line as the file has it: [date T time offset] [level] [tag …] the rest (log.ts, stamp; electron-log's local time with
// a space and no offset read too); a line not of that shape (an object's lines under an [electron] event) belongs to the
// one before it. The tag's group is the filter that shows it.
type Group = 'agent' | 'human' | 'tasks';
type Show = 'all' | 'errors' | Group;
interface Line { date: string; time: string; offset: string; level: string; tag: string; text: string; raw: string; group: Group | null; bad: boolean }
const GROUPS: Record<string, Group> = { mcp: 'agent', hook: 'agent', terminal: 'agent', ipc: 'human', key: 'human', settings: 'human', task: 'tasks', window: 'tasks', kulisa: 'tasks' };
const SHOW: { id: Show; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every line' },
  { id: 'errors', label: 'Errors', hint: 'Warnings and errors: a page\'s, Electron\'s, an action refused or failed' },
  { id: 'agent', label: 'Agent', hint: 'What the agent did: its tools, its hooks, its terminal' },
  { id: 'human', label: 'Human', hint: 'What you did: a window\'s messages, keys, Settings' },
  { id: 'tasks', label: 'Tasks', hint: 'Tasks and windows opened and closed, the start' }];
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
      into.push({ date: date!, time: time!, offset, level: level!, tag, text: body!, raw, group: GROUPS[tag] ?? null, bad: isBad(level!, tag, body!) });
    } else if (last >= 0) {
      const l = into[last]!, body = `${l.text}\n${raw}`;
      into[last] = { ...l, text: body, raw: `${l.raw}\n${raw}`, bad: isBad(l.level, l.tag, body) };
    }
  }
}

// What the main process sends as the log grows comes to the page shown, if any (kulisa.on has no way to stop listening).
let onLines: ((m: { text: string } | { reset: true }) => void) | null = null;
kulisa.on('log:lines', (m) => onLines?.(m));

const Row = memo(function Row({ l }: { l: Line }) {
  return <div data-tag={l.tag || undefined} data-group={l.group ?? undefined} data-bad={l.bad || undefined} title={`${l.date} ${l.offset}`.trim()}
    className={css.row}>
    <span className={css.time}>{l.time}</span>
    <span className={css.tag}>{l.tag && `[${l.tag}]`}</span>
    <span>{l.text}</span>
  </div>;
});

export function LogPage() {
  const [lines, setLines] = useState<Line[] | null>(null), [info, setInfo] = useState({ size: 0, max: 0, old: null as string | null });
  const [show, setShow] = useState<Show>('all'), [filter, setFilter] = useState(''), [follow, setFollow] = useState(true);
  const [error, setError] = useState('');
  const toaster = useId('log'), { dispatchToast } = useToastController(toaster);
  const box = useRef<HTMLDivElement>(null);

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
  // Follow keeps the end in view, as a terminal does; scrolling up lets go of it, checking it again goes back to the end.
  const toEnd = () => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; };
  useLayoutEffect(() => { if (follow) toEnd(); }, [shown, follow]);
  const scrolled = () => { const b = box.current!; setFollow(b.scrollHeight - b.scrollTop - b.clientHeight < 4); };

  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  const copy = async () => { await navigator.clipboard.writeText((lines ?? []).map((l) => l.raw).join('\n')); setError('');
    dispatchToast(<Toast><ToastTitle>Copied</ToastTitle></Toast>, { intent: 'success' }); };
  const save = async () => {
    const r = await kulisa.invoke('log:save');
    setError(refused(r) ? r.error : '');
    const file = !refused(r) && r.file;
    if (file) dispatchToast(<Toast><ToastTitle action={<Link onClick={() => void kulisa.invoke('file:show', file)}>Show in Folder</Link>}>Saved as {file}</ToastTitle></Toast>,
      { intent: 'success' });
  };
  const tip = (content: string, child: ReactElement) => <Tooltip content={content} relationship="description">{child}</Tooltip>;

  return <div className={css.page}>
    <Toaster toasterId={toaster} position="bottom-end" />
    <div className={css.bar}>
      <SearchBox size="small" value={filter} placeholder="Filter: a task, wc=1, [mcp]…" aria-label="Filter" spellCheck={false} onChange={(_, d) => setFilter(d.value)} />
      <Toolbar size="small" aria-label="Show" checkedValues={{ show: [show] }} onCheckedValueChange={(_, d) => { if (d.checkedItems[0]) setShow(d.checkedItems[0] as Show); }}>
        <ToolbarRadioGroup>
          {SHOW.map((s) => <Tooltip key={s.id} content={s.hint} relationship="description">
            <ToolbarRadioButton appearance="subtle" name="show" value={s.id}>{s.label}</ToolbarRadioButton></Tooltip>)}
        </ToolbarRadioGroup>
      </Toolbar>
      <span className={css.end}><Switch label="Follow" checked={follow} onChange={(_, d) => { setFollow(d.checked); if (d.checked) toEnd(); }} /></span>
    </div>
    <div ref={box} role="log" aria-label="Log" onScroll={scrolled} className={css.log}>
      {shown.map((l, i) => <Row key={i} l={l} />)}
      {lines && !shown.length && <Text>Nothing matches.</Text>}
    </div>
    <Caption1>
      kulisa.log, {kb(info.size)} of {Math.round(info.max / 1024 / 1024)} MB{info.old ? `; kulisa.old.log from ${info.old.slice(0, 10)}` : ''}. Never here: what you typed,
      passwords, tokens, cookies, the pages' queries.
    </Caption1>
    {error && <ErrorBar>{error}</ErrorBar>}
    <div className={css.actions}>
      {tip('The whole log, to paste anywhere', <Button onClick={() => void copy()}>Copy All</Button>)}
      {tip('The log as a file, to attach to a message or an issue', <Button onClick={() => void save()}>Save As…</Button>)}
      {tip('Its folder in your file manager', <Button onClick={() => void kulisa.invoke('log:show-folder')}>Open Folder</Button>)}
      <ButtonMenu end items={() => [{ label: 'On GitHub…', sub: 'a public issue, the environment filled in; attach the saved log', run: () => kulisa.invoke('log:report') }]}>
        <MenuButton appearance="primary">Report…</MenuButton>
      </ButtonMenu>
    </div>
  </div>;
}
