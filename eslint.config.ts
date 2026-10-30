// ESLint: only what tsc cannot see, with the types (docs/testing.md, Lint). Not the presets: they flag every `any` from
// JSON and IPC and the templates' formatting, about 2400 places and no bug.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import type { Rule } from 'eslint';

const EXPORT_ALL = { selector: 'ExportAllDeclaration', message: 'Re-export by name, not export *.' };
const PAUSE = 'A fixed pause proves nothing: wait for what shows it is done (docs/testing.md, Writing an e2e test).';
const PAUSES = [
  { selector: "CallExpression[callee.name='sleep']", message: PAUSE },
  { selector: "CallExpression[callee.property.name='waitForTimeout']", message: PAUSE },
  // new Promise((r) => setTimeout(r, ms)): a timer that only resolves.
  { selector: "NewExpression[callee.name='Promise'] > :function CallExpression[callee.name='setTimeout'][arguments.0.type='Identifier']", message: PAUSE },
];

const WINDOW = ['src/renderer/**/*.tsx', 'src/renderer/**/*.ts', 'src/*/renderer/**/*.tsx'];
const STYLE = "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property";
// The window is shadcn's components (src/ui) and Tailwind's classes on our own boxes (docs/ui.md, shadcn in Kulisa).
const OWN = [
  { selector: 'JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]', message: "src/ui's Button, Input, Select or Textarea (docs/ui.md)." },
  { selector: `${STYLE}[value.type='Literal']:not([key.value=/^--/])`, message: 'A constant style is a class; `style` holds only what run time knows (docs/ui.md).' },
];
// One way to draw: no second UI library, no CSS Module beside Tailwind.
const ONE_LOOK = { paths: [{ name: '@fluentui/react-components', message: "The window is shadcn's (src/ui; docs/ui.md)." }],
  patterns: [{ group: ['*.module.css'], message: "Tailwind's classes on our own box; a plain .css only for what they cannot say (docs/ui.md)." }] };
const HEX = { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: "A color is the theme's (bg-muted, var(--card); docs/ui.md)." };

// src/ui's components as shadcn's CLI makes them, their look the theme's alone (docs/ui.md, shadcn in Kulisa): on one
// only where it sits and how big it is: a literal of layout and size classes (w-64, flex-1, ms-auto), any variant
// before them (data-[x]:hidden); in `style`, a custom property or a size or place known at run time.
const LAYOUT = new RegExp(String.raw`^(?:[\w-]+(?:-\[[^\]]+\])?:)*!?(?:-?m[trblxyse]?-\S+|(?:min-|max-)?[wh]-\S+|size-\S+|flex-(?:1|auto|none|initial|\[[^\]]+\])|basis-\S+|(?:shrink|grow)(?:-0)?|(?:justify-|place-)?self-\S+|order-\S+|(?:col|row)-(?:span|start|end)-\S+|static|relative|absolute|fixed|sticky|-?(?:inset|top|right|bottom|left|start|end)(?:-[xy])?-\S+|z-\S+|hidden|sr-only|aspect-\S+|justify-(?:start|end|center|between)|items-(?:start|end|center|stretch))$`);
// A variable passed to a component, the standard way to configure one (docs/ui.md, shadcn in Kulisa).
const VARIABLE = /^\[--[\w-]+:[^\]]+\]$/;
const PLACE = new Set(['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'flexBasis', 'left', 'top', 'right', 'bottom', 'inset']);
const uiAsShipped: Rule.RuleModule = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const ui = new Set<string>();
    const report = (node: Rule.Node, what: string) => context.report({ node, message: `${what} (docs/ui.md, shadcn in Kulisa).` });
    return {
      ImportDeclaration(node) {
        if (node.source.value !== '@ui') return;
        for (const s of node.specifiers) if (s.type === 'ImportSpecifier') ui.add(s.local.name);
      },
      JSXAttribute(node: Rule.Node) {
        const n = node as unknown as { name: { name: string }; value: { type: string; value?: unknown; expression?: { type: string; expression?: unknown; properties?: { type: string; key: { type: string; name?: string; value?: unknown } }[] } } | null;
          parent: { name: { type: string; name?: string } } };
        const el = n.parent.name;
        if (el.type !== 'JSXIdentifier' || !ui.has(el.name!)) return;
        if (n.name.name === 'className') {
          if (n.value?.type !== 'Literal') return report(node, `className on ${el.name}: a literal of layout and size classes`);
          for (const c of String(n.value.value).split(/\s+/).filter(Boolean))
            if (!LAYOUT.test(c) && !VARIABLE.test(c)) report(node, `${c} on ${el.name}: its look is the theme's; only where it sits and its size`);
        } else if (n.name.name === 'style') {
          let e = n.value?.expression;
          if (e?.type === 'TSAsExpression') e = e.expression as typeof e; // custom properties are not in React's CSSProperties
          const props = e?.type === 'ObjectExpression' ? e.properties! : null;
          if (!props) return report(node, `style on ${el.name}: an object of custom properties and sizes`);
          for (const p of props) {
            const key = p.type === 'Property' ? String(p.key.name ?? p.key.value) : '...';
            if (!key.startsWith('--') && !PLACE.has(key)) report(node, `style.${key} on ${el.name}: its look is the theme's`);
          }
        }
      },
    };
  },
};
// The theme's colors, not Tailwind's palette nor a color written out: one palette, dark and light (docs/ui.md).
const PALETTE = String.raw`\b(?:bg|text|border|ring|fill|stroke|outline|from|via|to|shadow|decoration|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)\b|-\[(?:#|rgb|hsl|oklch|color)`;
const COLORS = { selector: `Literal[value=/${PALETTE}/], TemplateElement[value.raw=/${PALETTE}/]`, message: "A color is the theme's (bg-muted, text-destructive), not Tailwind's palette (docs/ui.md)." };

// An e2e test finds Kulisa's elements by role and name, label, text or data-testid, and reads a state by its attribute
// (aria-*, data-*): never by a class of Kulisa's CSS, which changes with the look (docs/testing.md, Writing an e2e
// test). dockview's (dv-*) and xterm's classes are theirs. A class in a selector: after its start, a space, a
// combinator, a bracket or a quote (a selector inside code in a string), or after a tag (button.x); not a file's name
// (.git, a.txt) nor a method called on a string in code.
const NOT = String.raw`(?!dv-|xterm|(?:kulisa|git|gitignore|claude|envrc|worktreeinclude|env|mcp|sock|github|away|dpkg-new|cmd|txt|png|ico|icns|spec|json|jsonl|sh|ts|js|log|md|old)\b)(?![\w-]*\()`;
const CLASS = new RegExp(String.raw`(?:^|[\s>+~,(:'"])\.${NOT}-?[a-z_][\w-]*|\b(?:a|button|div|span|img|input|li|svg|use|label|section|h[1-6])\.${NOT}[a-z_][\w-]*`);
const noKulisaClasses: Rule.RuleModule = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    const report = (node: Rule.Node, what: string) => context.report({ node, message: `A Kulisa class in an e2e test: ${what} (docs/testing.md, Writing an e2e test).` });
    const check = (node: Rule.Node, text: string) => { const m = CLASS.exec(text) ?? /\bclass(?:List|Name)\b/.exec(text); if (m) report(node, m[0].trim()); };
    const theirs = (call: Rule.Node) => call.type === 'CallExpression' && call.arguments[0]?.type === 'Literal' && /^(dv-|xterm)/.test(String(call.arguments[0].value));
    return {
      Literal(node) { if (typeof node.value === 'string') check(node, node.value); },
      TemplateElement(node) { check(node, node.value.raw); },
      // a class read or set by name: dockview's and xterm's alone
      "CallExpression[callee.property.name='toHaveClass']": (node: Rule.Node) => { if (!theirs(node)) report(node, 'toHaveClass'); },
      "MemberExpression[property.name='classList']": (node: Rule.Node) => { const call = node.parent.parent; if (!(call?.type === 'CallExpression' && theirs(call))) report(node, 'classList'); },
    };
  },
};

export default tseslint.config(
  { ignores: ['dist', 'out', '.claude/*', '!.claude/hooks', 'src/preload', 'src/ui/{components,hooks,lib}'] }, // src/ui's: shadcn's CLI's
  { files: ['**/*.ts', '**/*.mts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.ts', 'vite.config.mts', 'playwright.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // A promise not awaited is a forgotten await, or says it is meant: `void`.
      '@typescript-eslint/no-floating-promises': ['error', { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: 'test' }] }],
      // Not checksVoidReturn: an async callback whose caller does not wait is fine here, a rejection is logged (app.ts).
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // A folder's index.ts re-exports by name: its surface is what is written, not whatever a file happens to hold.
      'no-restricted-syntax': ['error', EXPORT_ALL],
    },
  },
  // React's rules that types cannot see: a hook called conditionally, an effect or memo missing what it reads; a ref
  // read or written while rendering, a render that is not pure, props or state changed in place, a component made
  // inside another, state set while rendering or copied in an effect (what breaks once React renders concurrently). Not
  // the preset's memoization rules: the window is not compiled by the React Compiler.
  { files: ['src/renderer/**', 'src/*/renderer/**'], plugins: { 'react-hooks': reactHooks },
    rules: Object.fromEntries(['rules-of-hooks', 'exhaustive-deps', 'refs', 'purity', 'immutability', 'globals', 'static-components',
      'set-state-in-render', 'set-state-in-effect'].map((r) => [`react-hooks/${r}`, 'error'])) },
  // The window is shadcn's as it ships (docs/ui.md): its controls, Lucide's icons, the theme's colors. What only run time
  // knows (a width, the project's color) may stay in `style`. The logos (Kulisa's, the agents' makers') are drawn in
  // their own colors.
  { files: WINDOW, plugins: { kulisa: { rules: { 'ui-as-shipped': uiAsShipped } } },
    rules: { 'no-restricted-imports': ['error', ONE_LOOK], 'kulisa/ui-as-shipped': 'error' } },
  { files: WINDOW, rules: { 'no-restricted-syntax': ['error', EXPORT_ALL, ...OWN, HEX, COLORS] } },
  { files: ['src/renderer/components/AgentMark.tsx', 'src/renderer/components/ProjectIcon.tsx'],
    rules: { 'no-restricted-syntax': ['error', EXPORT_ALL, ...OWN, COLORS] } },
  // An e2e test waits for a proof, never for a time: a pause long enough here is too short on a loaded machine, and
  // proves nothing when it is long enough (docs/testing.md, Writing an e2e test). A wait with an end is upTo (helpers.ts).
  { files: ['test/e2e/**'], plugins: { kulisa: { rules: { 'no-kulisa-classes': noKulisaClasses } } },
    rules: { 'no-restricted-syntax': ['error', EXPORT_ALL, ...PAUSES], 'kulisa/no-kulisa-classes': 'error' } },
);
