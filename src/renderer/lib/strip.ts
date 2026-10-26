// A strip of tabs that scrolls sideways when they do not fit (docs/ui.md, Controls): the tasks' bar, a pane's tabs, the
// closed profiles over the terminal, the terminals' tabs.
// The element scrolls sideways with no scrollbar (its own style); this module scrolls it by the wheel, fades the edges
// with tabs past them, keeps its chosen tab (aria-selected) in sight, and grows a panel's tab (.tab) in as it opens.
import { useEffect, useRef, type RefObject } from 'react';
import { reducedMotion } from './common';

const FADE = 24; // px: as wide as the strip's scroll-padding, so the tab in sight is clear of it
// What a strip element does, until dispose().
function strip(s: HTMLElement) {
  // Which edges have tabs past them (data-past-start, data-past-end), faded.
  const edges = () => {
    const start = s.scrollLeft > 1, end = s.scrollLeft < s.scrollWidth - s.clientWidth - 1;
    s.toggleAttribute('data-past-start', start);
    s.toggleAttribute('data-past-end', end);
    s.style.maskImage = start || end ? `linear-gradient(to right, transparent, #000 ${start ? FADE : 0}px, #000 calc(100% - ${end ? FADE : 0}px), transparent)` : '';
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
  // A panel's tab added to a strip that has tabs (not the first ones, nor a strip drawn whole) grows in from the left,
  // as Chrome's: data-opening until its animation ends, then brought into sight. An attribute, not a class: the tab's
  // :class would write over a class. With reduced motion it does not grow, so no animation ends: in sight at once
  // (else it stays opening, and out of sight).
  const opened = (t: Element) => {
    if (!t.matches('.tab')) return;
    if (reducedMotion.matches) { requestAnimationFrame(reveal); return; }
    t.setAttribute('data-opening', '');
    t.addEventListener('animationend', () => { t.removeAttribute('data-opening'); reveal(); }, { once: true });
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
  let filled = false; // the strip had tabs before these changes
  const tabs = new MutationObserver((changes) => {
    for (const c of changes) {
      for (const t of c.addedNodes) if (t instanceof Element) { grown.observe(t); if (filled) opened(t); }
      for (const t of c.removedNodes) if (t instanceof Element) grown.unobserve(t); // or the observer keeps it
    }
    filled = !!s.children.length;
    edges();
  });
  resized.observe(s);
  for (const t of s.children) grown.observe(t);
  filled = s.children.length > 0;
  tabs.observe(s, { childList: true });
  s.addEventListener('wheel', wheel, { passive: true });
  s.addEventListener('scroll', edges, { passive: true });
  return { reveal, dispose() { resized.disconnect(); grown.disconnect(); tabs.disconnect(); s.removeEventListener('wheel', wheel); s.removeEventListener('scroll', edges); } };
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
