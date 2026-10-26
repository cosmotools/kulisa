// ESLint: only what tsc cannot see, with the types (docs/testing.md, Lint). Not the presets: they flag every `any` from
// JSON and IPC and the templates' formatting, about 2400 places and no bug.
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
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
  { ignores: ['dist', 'out', '.claude/*', '!.claude/hooks', 'src/preload'] },
  ...vue.configs['flat/essential'],
  { files: ['**/*.ts', '**/*.mts', '**/*.tsx'], languageOptions: { parser: tseslint.parser } },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser, // a .vue file's script
        extraFileExtensions: ['.vue'],
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
      'vue/multi-word-component-names': 'off',
      // A folder's index.ts re-exports by name: its surface is what is written, not whatever a file happens to hold.
      'no-restricted-syntax': ['error', EXPORT_ALL],
    },
  },
  // React's rules that types cannot see: a hook called conditionally, an effect or memo missing what it reads; a ref
  // read or written while rendering, a render that is not pure, props or state changed in place, a component made
  // inside another, state set while rendering or copied in an effect (what breaks once React renders concurrently). Not
  // the preset's memoization rules: the window is not compiled by the React Compiler.
  { files: ['src/renderer/**/*.tsx', 'src/renderer/fluent/**'], plugins: { 'react-hooks': reactHooks },
    rules: Object.fromEntries(['rules-of-hooks', 'exhaustive-deps', 'refs', 'purity', 'immutability', 'globals', 'static-components',
      'set-state-in-render', 'set-state-in-effect'].map((r) => [`react-hooks/${r}`, 'error'])) },
  // An e2e test waits for a proof, never for a time: a pause long enough here is too short on a loaded machine, and
  // proves nothing when it is long enough (docs/testing.md, Writing an e2e test). A wait with an end is upTo (helpers.ts).
  { files: ['test/e2e/**'], plugins: { kulisa: { rules: { 'no-kulisa-classes': noKulisaClasses } } },
    rules: { 'no-restricted-syntax': ['error', EXPORT_ALL, ...PAUSES], 'kulisa/no-kulisa-classes': 'error' } },
  // Not in the Vue window: it took `{} as Record<…>` inside reactive({ … }) for needless, where only the `as` gives the
  // store's field its type (vue-tsc failed once they were removed); and it reads a .vue file's script without Vue's plugin.
  { files: ['src/renderer/**'], ignores: ['src/renderer/**/*.tsx', 'src/renderer/fluent/**'],
    rules: { '@typescript-eslint/no-unnecessary-type-assertion': 'off' } },
);
