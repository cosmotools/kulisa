// Fluent UI's theme in Kulisa's colors (the probe: Settings on React and Fluent UI): Fluent's tokens, a neutral brand,
// Inter and JetBrains Mono, softer corners. Only tokens: the components are Fluent's as they ship.
import { createContext } from 'react';
import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';
import type { TermStyle } from '../../terminal/renderer';

// A neutral ramp in place of Microsoft's blue: the main button and what is chosen in the text's own color.
const neutral: BrandVariants = {
  10: '#050505', 20: '#0f0f10', 30: '#18181b', 40: '#202024', 50: '#27272a', 60: '#3f3f46', 70: '#52525b', 80: '#71717a',
  90: '#8b8b94', 100: '#a1a1aa', 110: '#b4b4bc', 120: '#d4d4d8', 130: '#e4e4e7', 140: '#ededf0', 150: '#f4f4f5', 160: '#fafafa',
};

const shape = {
  fontFamilyBase: "'Inter Variable', 'Segoe UI', system-ui, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, monospace", // the terminal's, bundled (src/terminal/renderer)
  borderRadiusSmall: '4px', borderRadiusMedium: '6px', borderRadiusLarge: '8px', borderRadiusXLarge: '12px',
};

export const dark: Theme = {
  ...createDarkTheme(neutral), ...shape,
  colorNeutralBackground1: '#18181b', colorNeutralBackground1Hover: '#232327', colorNeutralBackground1Pressed: '#2a2a2f',
  colorNeutralBackground1Selected: '#27272a',
  colorNeutralBackground2: '#111113', colorNeutralBackground3: '#0c0c0e', colorNeutralBackground4: '#09090b',
  colorSubtleBackgroundHover: '#27272a', colorSubtleBackgroundPressed: '#2f2f34', colorSubtleBackgroundSelected: '#27272a',
  colorNeutralStroke1: '#3f3f46', colorNeutralStroke2: '#27272a', colorNeutralStroke3: '#202024',
  colorNeutralForeground1: '#fafafa', colorNeutralForeground2: '#d4d4d8', colorNeutralForeground3: '#a1a1aa',
  colorBrandBackground: '#fafafa', colorBrandBackgroundHover: '#e4e4e7', colorBrandBackgroundPressed: '#d4d4d8',
  colorNeutralForegroundOnBrand: '#09090b',
  colorBrandForeground1: '#fafafa', colorBrandForeground2: '#e4e4e7', colorCompoundBrandStroke: '#d4d4d8',
  colorCompoundBrandBackground: '#fafafa', colorNeutralForeground2BrandSelected: '#fafafa',
};

export const light: Theme = {
  ...createLightTheme(neutral), ...shape,
  colorNeutralBackground1: '#ffffff', colorNeutralBackground2: '#fafafa', colorNeutralBackground3: '#f4f4f5', colorNeutralBackground4: '#ededf0',
  colorNeutralStroke1: '#d4d4d8', colorNeutralStroke2: '#e4e4e7',
  colorNeutralForeground1: '#09090b', colorNeutralForeground2: '#3f3f46', colorNeutralForeground3: '#71717a',
  colorBrandBackground: '#18181b', colorBrandBackgroundHover: '#27272a', colorBrandBackgroundPressed: '#3f3f46',
  colorNeutralForegroundOnBrand: '#fafafa',
  colorBrandForeground1: '#18181b', colorCompoundBrandStroke: '#3f3f46', colorCompoundBrandBackground: '#18181b',
  colorNeutralForeground2BrandSelected: '#09090b',
};

// A window's theme: the page's data-theme (its URL, then the main process's 'theme'), System as the OS's.
export const shade = (theme: string | undefined) => (theme === 'light' || (theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark');

// The theme shown, for what draws in its colors outside Fluent's components (a terminal: Terminal.tsx); the one given
// to FluentProvider.
export const ThemeShown = createContext<Theme>(dark);

// A terminal's colors and font in a theme: the place's background (a Fluent color token), its text, its font size.
export type ColorToken = Extract<keyof Theme, `color${string}`>;
export const termStyle = (t: Theme, background: ColorToken): TermStyle => ({
  colors: { background: t[background], foreground: t.colorNeutralForeground1, selection: t.colorNeutralStroke1 },
  fontSize: parseFloat(t.fontSizeBase300),
});
