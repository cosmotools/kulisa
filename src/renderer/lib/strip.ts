// A strip of tabs that scrolls sideways when they do not fit (docs/ui.md, Tab strips): the tasks' bar, a pane's tabs.
// The element has .tabstrip (components.css: no scrollbar, its edges faded); this module scrolls it by the wheel,
// says which edges have tabs past them, and keeps its .active tab in sight.
import { nextTick, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';

// strip: the element; active: what changes when another tab is chosen (its key).
export function useStrip(strip: Ref<HTMLElement | undefined>, active: () => unknown) {
  // Which edges have tabs past them, faded (.past-start, .past-end). Classes set here, not bound in the template:
  // the element has no :class of its own for Vue to write over them.
  const edges = () => {
    const s = strip.value;
    if (!s) return;
    s.classList.toggle('past-start', s.scrollLeft > 1);
    s.classList.toggle('past-end', s.scrollLeft < s.scrollWidth - s.clientWidth - 1);
  };
  // The active tab in sight, clear of the fades (scroll-padding), the strip alone scrolled (scrollIntoView moved the
  // window's grid once, docs/window.md). Only when another is chosen, a tab grows in or the strip is resized: on
  // every update (a title, a page loading, an agent's state) it took the strip back from where the human scrolled it.
  const reveal = () => {
    const s = strip.value, a = s?.querySelector('.active')?.getBoundingClientRect();
    if (!s || !a) return;
    const b = s.getBoundingClientRect(), pad = parseFloat(getComputedStyle(s).scrollPaddingInlineStart) || 0;
    if (a.left < b.left + pad) s.scrollLeft -= b.left + pad - a.left;
    else if (a.right > b.right - pad) s.scrollLeft += a.right - (b.right - pad);
    edges(); // at once: the scroll event comes a frame later
  };
  // A mouse's wheel turns up and down, and the strip scrolls only sideways; Shift and a touchpad's sideways swipe are
  // the browser's (with Shift both scrolled, twice as far).
  const wheel = (e: WheelEvent) => {
    if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) strip.value!.scrollLeft += e.deltaY;
  };
  watch(active, () => nextTick(reveal));
  // The strip resized (also reported once when watched): the active one in sight. A tab added, closed or grown changes
  // how far the tabs reach: the edges again.
  const resized = new ResizeObserver(reveal);
  const grown = new ResizeObserver(edges);
  const tabs = new MutationObserver((changes) => {
    for (const c of changes) {
      for (const t of c.addedNodes) if (t instanceof Element) grown.observe(t);
      for (const t of c.removedNodes) if (t instanceof Element) grown.unobserve(t); // or the observer keeps it
    }
    edges();
  });
  const off = () => { resized.disconnect(); grown.disconnect(); tabs.disconnect(); };
  // The element may come later than the component (a pane drawn once its profile is there).
  watch(strip, (s, was) => {
    off();
    was?.removeEventListener('wheel', wheel);
    was?.removeEventListener('scroll', edges);
    if (!s) return;
    resized.observe(s);
    for (const t of s.children) grown.observe(t);
    tabs.observe(s, { childList: true });
    s.addEventListener('wheel', wheel, { passive: true });
    s.addEventListener('scroll', edges, { passive: true });
  }, { immediate: true, flush: 'post' });
  onUnmounted(off);
  return { reveal };
}
