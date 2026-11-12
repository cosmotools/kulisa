// Raising the loaded transparent shell covers native siblings through overlay exit animations (docs/window.md).
import { coverUnder } from './cover';
let raised = false;
const present = () => !!document.querySelector('#settings, [data-slot$="-overlay"], [data-radix-popper-content-wrapper] > :not([data-slot="tooltip-content"])');
async function update() {
  const covered = present();
  if (covered === raised) return;
  raised = covered;
  await kulisa.invoke('shell:cover', covered);
}
coverUnder({ hide: update, freeze: async () => { raised = true; await kulisa.invoke('shell:cover', true); }, unfreeze: update });
new MutationObserver(() => { void update(); }).observe(document.body, { childList: true, subtree: true });
