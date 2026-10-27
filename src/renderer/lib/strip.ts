// A strip of tabs that scrolls sideways when they do not fit (docs/ui.md, Controls): the tasks' bar, a pane's tabs, the
// closed profiles over the terminal, the terminals' tabs.
// useStrip scrolls it by the wheel, says which edges have tabs past them, keeps its chosen tab (aria-selected) in sight;
// it marks the strip data-strip, which strip.css draws: no scrollbar, its edges faded. A panel's tab with grow as its
// ref grows in as it opens.
import { useEffect, useRef, type RefObject } from 'react';
import { reducedMotion } from './common';
import './strip.css';

// The strips that had tabs before the change being committed: the MutationObserver below marks them after React's
// commit, so a tab's motion (started by its ref, before that) still sees the strip as it was.
const filled = new WeakSet<Element>();

// A tab added to a strip that has tabs (not the first ones, nor a strip drawn whole) grows in from the left, as
// Chrome's: its ref. clip-path, not overflow (not animatable): what the tab holds is cut at its edge while it is
// narrow. fill none: once grown, the tab is laid out by its own styles again. None with reduced motion.
export const grow = (tab: HTMLElement | null) => {
  if (!tab?.parentElement || !filled.has(tab.parentElement) || reducedMotion.matches) return;
  tab.animate([{ width: '0px', minWidth: '0px', paddingInline: '0px', clipPath: 'inset(0)' }, { clipPath: 'inset(0)' }],
    { duration: 200, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)', fill: 'none' });
};

// What a strip element does, until dispose().
function strip(s: HTMLElement) {
  s.setAttribute('data-strip', '');
  // Which edges have tabs past them (data-past-start, data-past-end), faded.
  const edges = () => {
    s.toggleAttribute('data-past-start', s.scrollLeft > 1);
    s.toggleAttribute('data-past-end', s.scrollLeft < s.scrollWidth - s.clientWidth - 1);
  };
  // The active tab in sight, clear of the fades (scroll-padding), the strip alone scrolled (scrollIntoView moved the
  // window's grid once, docs/window.md). Only when another is chosen, a tab grows in or the strip is resized: on
  // every update (a title, a page loading, an agent's state) it took the strip back from where the human scrolled it.
  const reveal = () => {
    const a = s.querySelector('[aria-selected="true"]')?.getBoundingClientRect();
    if (!a) return;
    const b = s.getBoundingClientRect(), pad = parseFloat(getComputedStyle(s).scrollPaddingInlineStart) || 0;
    if (a.left < b.left + pad) s.scrollLeft -= b.left + pad - a.left;
    else if (a.right > b.right - pad) s.scrollLeft += a.right - (b.right - pad);
    edges(); // at once: the scroll event comes a frame later
  };
  // A tab growing in (grow's motion, started before the observer hears of it): data-opening until it has grown, then
  // brought into sight. An attribute, not a class: React writes the tab's className over one. Its own animations
  // only, not a CSS transition of its look.
  const opened = (t: Element) => {
    const growing = t.getAnimations().filter((a) => !(a instanceof CSSTransition) && !(a instanceof CSSAnimation));
    if (!growing.length) return;
    t.setAttribute('data-opening', '');
    let left = growing.length;
    const done = () => { if (--left) return; t.removeAttribute('data-opening'); reveal(); };
    for (const a of growing) { a.addEventListener('finish', done, { once: true }); a.addEventListener('cancel', done, { once: true }); }
  };
  // A mouse's wheel turns up and down, and the strip scrolls only sideways; Shift and a touchpad's sideways swipe are
  // the browser's (with Shift both scrolled, twice as far).
  const wheel = (e: WheelEvent) => {
    if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) s.scrollLeft += e.deltaY;
  };
  // The strip resized (also reported once when watched): the active one in sight. A tab added, closed or grown changes
  // how far the tabs reach: the edges again.
  const resized = new ResizeObserver(reveal);
  const grown = new ResizeObserver(edges);
  const fill = () => { if (s.children.length) filled.add(s); else filled.delete(s); };
  const tabs = new MutationObserver((changes) => {
    for (const c of changes) {
      for (const t of c.addedNodes) if (t instanceof Element) { grown.observe(t); opened(t); }
      for (const t of c.removedNodes) if (t instanceof Element) grown.unobserve(t); // or the observer keeps it
    }
    fill();
    edges();
  });
  resized.observe(s);
  for (const t of s.children) grown.observe(t);
  fill();
  tabs.observe(s, { childList: true });
  s.addEventListener('wheel', wheel, { passive: true });
  s.addEventListener('scroll', edges, { passive: true });
  return { reveal, dispose() { resized.disconnect(); grown.disconnect(); tabs.disconnect(); filled.delete(s); s.removeEventListener('wheel', wheel); s.removeEventListener('scroll', edges); } };
}

// ref: the strip's element; active: what changes when another tab is chosen (its key).
export function useStrip(ref: RefObject<HTMLElement | null>, active: unknown) {
  const shown = useRef<ReturnType<typeof strip> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const it = shown.current = strip(ref.current);
    return () => { it.dispose(); shown.current = null; };
  }, [ref]);
  useEffect(() => { const f = requestAnimationFrame(() => shown.current?.reveal()); return () => cancelAnimationFrame(f); }, [active]);
}
