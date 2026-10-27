// Fluent UI's theme: Fluent's tokens with a neutral brand, Inter and JetBrains Mono (bundled: the same on every OS,
// offline). Only tokens: the components are Fluent's as they ship (docs/ui.md).
import { createDarkTheme, createLightTheme, tokens, type BrandVariants, type Theme } from '@fluentui/react-components';

// A neutral ramp in place of Microsoft's blue: the main button and what is chosen in the text's own color.
const neutral: BrandVariants = {
  10: '#050505', 20: '#0f0f10', 30: '#18181b', 40: '#202024', 50: '#27272a', 60: '#3f3f46', 70: '#52525b', 80: '#71717a',
  90: '#8b8b94', 100: '#a1a1aa', 110: '#b4b4bc', 120: '#d4d4d8', 130: '#e4e4e7', 140: '#ededf0', 150: '#f4f4f5', 160: '#fafafa',
};

const fonts = {
  fontFamilyBase: "'Inter Variable', 'Segoe UI', system-ui, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, monospace", // the terminal's, bundled (src/terminal/renderer)
};

// Fluent draws its nav (NavDrawer: Settings', the sidebar's) on Background4, the darkest, as a frame around an app;
// Kulisa's nav sits on the window's own background (Background2), as Windows' Settings, its hover and pressed following.
const nav = (t: Theme): Theme => ({ ...t, colorNeutralBackground4: t.colorNeutralBackground2,
  colorNeutralBackground4Hover: t.colorNeutralBackground2Hover, colorNeutralBackground4Pressed: t.colorNeutralBackground2Pressed,
  colorNeutralBackground4Selected: t.colorNeutralBackground2Selected });

// Fluent's own neutrals (backgrounds, strokes, text) but the nav's: ours are the brand ramp, the fonts and the nav.
export const dark: Theme = { ...nav(createDarkTheme(neutral)), ...fonts };
export const light: Theme = { ...nav(createLightTheme(neutral)), ...fonts };

// A dangerous question's main button (Delete): Fluent's Button has no danger appearance, so a FluentProvider of this
// around it makes the brand's colors the danger ones (tokens: the theme around it decides them).
export const danger: Partial<Theme> = {
  colorBrandBackground: tokens.colorStatusDangerBackground3, colorBrandBackgroundHover: tokens.colorStatusDangerBackground3Hover,
  colorBrandBackgroundPressed: tokens.colorStatusDangerBackground3Pressed, colorNeutralForegroundOnBrand: tokens.colorNeutralForegroundStaticInverted,
};
