// Keyboard Shortcuts (☰, or its key; docs/window.md, Keys), from the same table that takes the keys (main/keys.ts),
// so it is never out of date. A key held alone (the dictation's) is the human's to change: Change, then the key pressed
// is it (keys:set; the main process says what may not be one).
import { useEffect, useState } from 'react';
import { CircleAlertIcon } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, FieldDescription, FieldLegend, FieldSet, Kbd, Table, TableBody, TableCell,
  TableRow, Alert, AlertDescription } from '@ui';
import { registerDialog } from '../lib/dialogs';
import { useShortcuts } from '../lib/common';
import { refused } from '../../shared/result';
import { Tip } from './Tip';

const GROUPS = [
  ['global', 'Everywhere', 'In the window, the pages and the terminal.'],
  ['page', 'In a profile\'s page', 'Chrome\'s keys, for that profile\'s pane: also in its address bar.'],
  ['terminal', 'In the terminal', 'Every other key goes to the agent.'],
];

export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const shortcuts = useShortcuts();
  const [listening, setListening] = useState<string | null>(null); // the id whose key is pressed next
  const [message, setMessage] = useState('');
  useEffect(() => registerDialog('shortcuts', { showShortcuts() { setMessage(''); setOpen(true); } }), []);
  // The next key pressed, before the dialog's own (Esc stops listening, the dialog stays: onEscapeKeyDown).
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
  // The keyboard to the dialog itself, not its first Change: that one's tooltip would open and take the first Esc.
  return <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setListening(null); }}>
    <DialogContent aria-describedby={undefined} showCloseButton={false} className="sm:max-w-xl" onEscapeKeyDown={(e) => { if (listening) e.preventDefault(); }}
      onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
      <DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
      <div className="flex max-h-[60vh] min-h-0 flex-col gap-5 overflow-auto">
        {GROUPS.map(([group, title, hint]) => <FieldSet key={group}>
          <FieldLegend variant="label">{title}</FieldLegend>
          <FieldDescription>{hint}</FieldDescription>
          <Table aria-label={title}>
            <TableBody>
              {shortcuts.filter((s) => s.group === group).map((s) => <TableRow key={s.id} data-shortcut={s.id}>
                <TableCell>{s.label}</TableCell>
                <TableCell><div className="flex items-center justify-end gap-1.5">
                  {listening === s.id ? <Kbd data-key>Press a key…</Kbd> : s.keys.map((k) => <Kbd key={k} data-key>{k}</Kbd>)}
                  {s.hold && <Tip text="Press the key to hold instead: a Ctrl, Shift, Alt or ⌘ by its side, an F key, Insert, Pause or Scroll Lock">
                    <Button variant="outline" size="xs" disabled={listening === s.id} onClick={() => change(s.id)}>Change</Button></Tip>}
                </div></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
          {group === 'global' && message && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription><span data-selectable>{message}</span></AlertDescription></Alert>}
        </FieldSet>)}
      </div>
      <DialogFooter><Button onClick={() => setOpen(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
