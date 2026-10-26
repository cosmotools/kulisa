// The empty window (docs/window.md): no task open. The shell: what is there.
import { useWindow, pageOf } from '../lib/store';

export function Empty() {
  const page = useWindow(pageOf);
  return <div id="empty" data-page={page} />;
}
