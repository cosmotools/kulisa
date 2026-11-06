// JetBrains-style code colors and supported shortcuts; ownership and limits are in ../README.md.
import { registerCustomTheme } from '@pierre/diffs';
import type { EditorKeymap } from '@pierre/diffs/edit';

export const editorTheme = { light: 'kulisa-editor-light', dark: 'kulisa-editor-dark' };
const palette = getComputedStyle(document.documentElement);
for (const shade of ['light', 'dark'] as const) {
  const color = (key: string) => palette.getPropertyValue(`--code-${shade}-${key}`).trim();
  // Live tokenization expects actual RGBA colors. CSS-variable palettes render packed token indices as nearly
  // transparent colors in Pierre 1.6.4; resolve our two static palettes before registering the editor themes.
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
