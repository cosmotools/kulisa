// JetBrains-style code colors and supported shortcuts; ownership and limits are in ../README.md.
import { registerCustomTheme } from '@pierre/diffs';
import type { CSSProperties } from 'react';
import type { EditorKeymap } from '@pierre/diffs/edit';

export const editorTheme = { light: 'kulisa-editor-light', dark: 'kulisa-editor-dark' };
const palettes = {
  light: {
    foreground: '#080808', background: '#ffffff', comment: '#8c8c8c', keyword: '#0033b3',
    string: '#067d17', constant: '#1750eb', function: '#00627a', property: '#871094',
    'active-line': '#f5f8fe', selection: '#a6d2ff', 'line-number': '#aeb3c2', 'bracket-match': '#93d9d9',
  },
  dark: {
    foreground: '#bcbec4', background: '#1e1f22', comment: '#7a7e85', keyword: '#cf8e6d',
    string: '#6aab73', constant: '#2aacb8', function: '#56a8f5', property: '#c77dbb',
    'active-line': '#26282e', selection: '#214283', 'line-number': '#4b5059', 'bracket-match': '#43454a',
  },
};
for (const shade of ['light', 'dark'] as const) {
  const palette = palettes[shade];
  const color = (key: keyof typeof palette) => palette[key];
  // Live tokenization expects actual RGBA colors. CSS-variable palettes render packed token indices as nearly
  // transparent colors in Pierre 1.6.4, so themes use the package's literal colors.
  registerCustomTheme(editorTheme[shade], async () => ({ name: editorTheme[shade], type: shade, colors: {
    'editor.foreground': color('foreground'), 'editor.background': color('background'),
    'editor.lineHighlightBackground': color('active-line'), 'editor.lineHighlightBorder': 'transparent',
    'editor.selectionBackground': color('selection'), 'editorCursor.foreground': color('foreground'),
    'editorBracketMatch.background': color('bracket-match'), 'editorBracketMatch.border': 'transparent',
  }, tokenColors: [
    { scope: 'comment', settings: { foreground: color('comment') } },
    { scope: ['keyword', 'storage', 'constant.language'], settings: { foreground: color('keyword') } },
    { scope: 'keyword.operator', settings: { foreground: color('foreground') } },
    { scope: 'constant.numeric', settings: { foreground: color('constant') } },
    { scope: ['constant.other', 'variable.other.property'], settings: { foreground: color('property') } },
    { scope: 'string', settings: { foreground: color('string') } },
    { scope: 'constant.character.escape', settings: { foreground: color('keyword') } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: color('function') } },
    { scope: ['variable.parameter', 'punctuation'], settings: { foreground: color('foreground') } },
  ] }), 'textmate');
}

export function editorStyle(shade: 'light' | 'dark'): CSSProperties {
  return { '--code-background': palettes[shade].background, '--code-line-number': palettes[shade]['line-number'] } as CSSProperties;
}

// Only commands with the same meaning are remapped. Pierre's copy-line and delete-to-line-end commands are not
// JetBrains' duplicate-selection and delete-line actions, so those shortcuts keep their existing behavior.
export const keymap: EditorKeymap = [
  { bindings: { 'cmdOrCtrl+r': 'openSearchReplacePanel', 'shift+Enter': 'insertBlankLine',
    'shift+alt+ArrowUp': 'moveLineUp', 'shift+alt+ArrowDown': 'moveLineDown' } },
  { platform: 'linux', bindings: { 'ctrl+shift+/': 'toggleBlockComment' } },
  { platform: 'windows', bindings: { 'ctrl+shift+/': 'toggleBlockComment' } },
  { platform: 'mac', bindings: { 'cmd+alt+/': 'toggleBlockComment' } },
];

export const editorCSS = `
pre { user-select: text; }
:host { --diffs-fg-number-override: var(--code-line-number); }
[data-column-number][data-editor-active-line] {
  color: var(--diffs-fg);
}
`;
