// The theme shown (docs/ui.md, The theme): the root's data-theme (Dark, Light or System: its page's URL, then the main
// process's, store.ts) as shadcn's `dark` class, before React draws; and the theme's colors for what draws outside CSS
// (a terminal).
import { useSyncExternalStore } from 'react';
import type { TermStyle } from '../../terminal/renderer';

const osDark = matchMedia('(prefers-color-scheme: dark)');
const shade = (theme: string | undefined): 'dark' | 'light' => (theme === 'light' || (theme === 'system' && !osDark.matches) ? 'light' : 'dark');

const root = document.documentElement, listeners = new Set<() => void>();
root.dataset.theme ??= new URLSearchParams(location.search).get('theme') ?? 'dark'; // a master's window: its URL alone
let shown = shade(root.dataset.theme);
const apply = () => {
  const theme = root.dataset.theme;
  root.classList.toggle('dark', shade(theme) === 'dark');
  root.style.colorScheme = theme === 'system' ? 'light dark' : shade(theme); // scrollbars, the native controls
  if (shade(theme) === shown) return;
  shown = shade(theme);
  for (const l of listeners) l();
};
apply();
new MutationObserver(apply).observe(root, { attributeFilter: ['data-theme'] });
osDark.addEventListener('change', apply);

// The shade shown, to draw again in its colors (a terminal): its class is on the root by then.
export const useShade = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => shown);

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
// A terminal's colors and font in the theme shown: the place's background (a variable of the theme), its text, the
// window's text size (Tailwind's text-sm, what shadcn's components write in).
export const termStyle = (background = '--card'): TermStyle => ({
  colors: { background: color(background), foreground: color('--foreground'), selection: color('--ring') },
  fontSize: parseFloat(getComputedStyle(root).getPropertyValue('--text-sm')) * parseFloat(getComputedStyle(root).fontSize) || 14,
});
