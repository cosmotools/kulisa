// A project's color as the window shows it (docs/tasks.md, Projects: its color and icon, nothing to choose).
import { reactive } from 'vue';
import { getPaletteSync } from 'colorthief';
import type { ProjectEntry } from '../types';

// A favicon's hue in the lightness and chroma of Kulisa's own colors (store.ts, PROJECT_COLORS: about 0.61, 0.12), so
// it suits both themes as they do: a site's own navy or yellow, as it is, was lost in one of them.
const LIGHTNESS = 0.61, CHROMA = 0.12, SIZE = 32;
const colors = reactive(new Map<string, string | null>()); // a favicon's picture: its color, or null: it has none
const started = new Set<string>();

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

// Its favicon's color once read (it comes a moment later: reactive), else the one it was given (the next free one).
export function projectColor(p: Pick<ProjectEntry, 'color' | 'favicon'>): string {
  const src = p.favicon;
  if (!src) return p.color;
  if (!started.has(src)) {
    started.add(src);
    colorOf(src).then((c) => colors.set(src, c), (err) => { console.error('[project color]', err); colors.set(src, null); });
  }
  return colors.get(src) || p.color;
}
