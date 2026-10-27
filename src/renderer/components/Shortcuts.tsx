// Keyboard Shortcuts (☰, or its key; docs/window.md, Keys), from the same table that takes the keys (main/keys.ts),
// so it is never out of date. A key held alone (the dictation's) is the human's to change: Change, then the key pressed
// is it (keys:set; the main process says what may not be one).
import { useEffect, useState } from 'react';
import { Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Table, TableBody, TableCell,
  TableRow, Text, tokens } from '@fluentui/react-components';
import { useCovered } from '../lib/cover';
import { registerDialog } from '../lib/dialogs';
import { useShortcuts } from '../lib/common';
import { refused } from '../../shared/result';

const GROUPS = [
  ['global', 'Everywhere', 'In the window, the pages and the terminal.'],
  ['page', 'In a profile\'s page', 'Chrome\'s keys, for that profile\'s pane: also in its address bar.'],
  ['terminal', 'In the terminal', 'Every other key goes to the agent.'],
];

export function Shortcuts() {
  const { open, setOpen } = useCovered('hide');
  const shortcuts = useShortcuts();
  const [listening, setListening] = useState<string | null>(null); // the id whose key is pressed next
  const [message, setMessage] = useState('');
  useEffect(() => registerDialog('shortcuts', { showShortcuts() { setMessage(''); setOpen(true); } }), [setOpen]);
  // The next key pressed, before the dialog's own (Esc stops listening, the dialog stays).
  useEffect(() => {
    if (!listening) return;
    const take = async (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { setListening(null); return; }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key) && !e.code) return;
      setListening(null);
      const r = await kulisa.invoke('keys:set', { id: listening, code: e.code });
      setMessage(refused(r) ? r.error : '');
    };
    document.addEventListener('keydown', take, true);
    return () => document.removeEventListener('keydown', take, true);
  }, [listening]);
  const change = (id: string) => { setMessage(''); setListening(id); };
  return <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); if (!d.open) setListening(null); }}>
    <DialogSurface style={{ maxWidth: 560 }}>
      <DialogBody>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          {GROUPS.map(([group, title, hint]) => <section key={group} aria-label={title} style={{ marginBottom: 16 }}>
            <Text as="h3" weight="semibold" block style={{ margin: 0 }}>{title}</Text>
            <Text size={200} block style={{ color: tokens.colorNeutralForeground3, marginBottom: 4 }}>{hint}</Text>
            <Table size="small" aria-label={title}>
              <TableBody>
                {shortcuts.filter((s) => s.group === group).map((s) => <TableRow key={s.id} data-shortcut={s.id}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell><div style={{ display: 'flex', justifyContent: 'end', alignItems: 'center', gap: 6 }}>
                    {listening === s.id ? <Badge data-key appearance="outline" color="subtle">Press a key…</Badge>
                      : s.keys.map((k) => <Badge key={k} data-key appearance="outline" color="informative">{k}</Badge>)}
                    {s.hold && <Button size="small" disabled={listening === s.id} onClick={() => change(s.id)}
                      title="Press the key to hold instead: a Ctrl, Shift, Alt or ⌘ by its side, an F key, Insert, Pause or Scroll Lock">Change</Button>}
                  </div></TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
            {group === 'global' && message && <Text role="alert" size={200} block style={{ color: tokens.colorPaletteRedForeground1, marginTop: 8 }}>{message}</Text>}
          </section>)}
        </DialogContent>
        <DialogActions><Button appearance="primary" onClick={() => setOpen(false)}>Close</Button></DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
