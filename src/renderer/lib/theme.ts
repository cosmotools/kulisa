// The theme shown (docs/ui.md, shadcn in Kulisa): public/theme.js puts it on the root, from the page's URL before the
// first paint, then as the main process changes it (setTheme, store.ts); here the shade shown, and the theme's colors
// for what draws outside CSS (a terminal).
import { createStore, useStore } from 'zustand';
import type { TermStyle } from '../../terminal/renderer';

const root = document.documentElement;
const shadeOnRoot = () => (root.classList.contains('dark') ? 'dark' : 'light');
const shade = createStore(shadeOnRoot);
const shadeShown = () => shade.setState(shadeOnRoot(), true);
export const setTheme = (theme: string) => { showTheme(theme); shadeShown(); };
// After public/theme.js's own listener, added first, has shown System's shade.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', shadeShown);

// The shade shown, to draw again in its colors (a terminal): its class is on the root by then.
export const useShade = () => useStore(shade);

// A theme's color (a CSS variable of src/ui's theme: '--card') as xterm reads colors: rgba(), through a canvas, as the
// theme's are oklch().
const pixel = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!;
function color(variable: string) {
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = getComputedStyle(root).getPropertyValue(variable).trim() || 'transparent';
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${+(a! / 255).toFixed(3)})`;
}
// A terminal's colors and font in the theme shown: the card's background, its text, the window's text size
// (Tailwind's text-sm, what shadcn's components write in).
export const termStyle = (): TermStyle => ({
  colors: { background: color('--card'), foreground: color('--foreground'), selection: color('--ring') },
  fontSize: parseFloat(getComputedStyle(root).getPropertyValue('--text-sm')) * parseFloat(getComputedStyle(root).fontSize) || 14,
});
