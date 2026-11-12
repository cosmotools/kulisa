// Keyboard zone of this UI; main chooses shell versus task commands.
import { dialogsShown, onDialogs } from './cover';
export let zone = 'window';
export let lastPane: string | null = null; // the profile whose page or pane had the keyboard last: where Ctrl+` goes back to
const zoneOf = (el: Element | null) => {
  if (dialogsShown()) return 'dialog'; // its keys are its own, wherever its focus is
  if (!el || el === document.body) return 'window';
  if (el.closest('[data-zone="terminal"]')) return 'terminal';
  const pane = el.closest<HTMLElement>('[role="region"][data-profile]');
  return pane ? `pane:${pane.dataset.profile}` : 'window';
};
const report = () => {
  const z = zoneOf(document.activeElement);
  if (z.startsWith('pane:')) lastPane = z.slice('pane:'.length);
  if (z !== zone) { zone = z; kulisa.send('keys:zone', z); }
};
document.addEventListener('focusin', report);
document.addEventListener('focusout', () => setTimeout(report)); // where it went is known after the event
onDialogs(report); // a dialog opened or closed

