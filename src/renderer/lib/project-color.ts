// A project's color as the window shows it (docs/tasks.md, Projects: its color and icon, nothing to choose).
import { createStore, useStore } from 'zustand';
import { getPaletteSync } from 'colorthief';
import type { ProjectEntry } from '../../shared/types';

// A favicon's hue in the lightness and chroma of Kulisa's own colors (src/main/store.ts, PROJECT_COLORS: about 0.61,
// 0.12), so it suits both themes as they do: a site's own navy or yellow, as it is, is lost in one of them.
const LIGHTNESS = 0.61, CHROMA = 0.12, SIZE = 32;
// A favicon's picture: its color; null: none, or not read yet. Not the store's state: first asked for during a render,
// where a store's change would redraw other components.
const colors = new Map<string, string | null>();
// How many are read: what draws again once one is.
const read = createStore(() => 0);
export const onColors = (l: () => void) => read.subscribe(() => l());
const got = (src: string, c: string | null) => { colors.set(src, c); read.setState((n) => n + 1, true); };

// Its color: the hue of most of its colored pixels. Near-black ones are left out here: HSV, colorthief's minSaturation,
// calls a dark red saturated. Too few colored ones (a black or gray mark, an SVG in currentColor): none.
async function colorOf(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const g = new OffscreenCanvas(SIZE, SIZE).getContext('2d')!;
  g.drawImage(img, 0, 0, SIZE, SIZE);
  const palette = getPaletteSync(g.getImageData(0, 0, SIZE, SIZE), { colorCount: 5, quality: 1, minSaturation: 0.2 }) || [];
  const colored = palette.filter((c) => { const { l, c: chroma } = c.oklch(); return chroma >= 0.04 && l >= 0.25; });
  if (colored.reduce((sum, c) => sum + c.proportion, 0) < 0.1) return null;
  const top = colored.reduce((a, b) => (b.proportion > a.proportion ? b : a));
  return `oklch(${LIGHTNESS} ${CHROMA} ${Math.round(top.oklch().h)})`;
}

// Its favicon's color once read (it comes a moment later: onColors, useProjectColor), else the one it was given (the
// next free one).
export function projectColor(p: Pick<ProjectEntry, 'color' | 'favicon'>): string {
  const src = p.favicon;
  if (!src) return p.color;
  if (!colors.has(src)) {
    colors.set(src, null);
    colorOf(src).then((c) => got(src, c), (err) => { console.error('[project color]', err); got(src, null); });
  }
  return colors.get(src) || p.color;
}
// projectColor for a component: it draws again once a color is read.
export const useProjectColor = () => { useStore(read); return projectColor; };
