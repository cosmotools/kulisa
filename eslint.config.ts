// ESLint: only what tsc cannot see, with the types (docs/testing.md, Lint). Not the presets: they flag every `any` from
// JSON and IPC and the templates' formatting, about 2400 places and no bug.
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

const EXPORT_ALL = { selector: 'ExportAllDeclaration', message: 'Re-export by name, not export *.' };
const PAUSE = 'A fixed pause proves nothing: wait for what shows it is done (docs/testing.md, Writing an e2e test).';
const PAUSES = [
  { selector: "CallExpression[callee.name='sleep']", message: PAUSE },
  { selector: "CallExpression[callee.property.name='waitForTimeout']", message: PAUSE },
  // new Promise((r) => setTimeout(r, ms)): a timer that only resolves.
  { selector: "NewExpression[callee.name='Promise'] > :function CallExpression[callee.name='setTimeout'][arguments.0.type='Identifier']", message: PAUSE },
];

export default tseslint.config(
  { ignores: ['dist', 'out', '.claude/*', '!.claude/hooks', 'src/preload'] },
  ...vue.configs['flat/essential'],
  { files: ['**/*.ts', '**/*.mts'], languageOptions: { parser: tseslint.parser } },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
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
  // An e2e test waits for a proof, never for a time: a pause long enough here is too short on a loaded machine, and
  // proves nothing when it is long enough (docs/testing.md, Writing an e2e test). A wait with an end is upTo (helpers.ts).
  { files: ['test/e2e/**'], rules: { 'no-restricted-syntax': ['error', EXPORT_ALL, ...PAUSES] } },
  // Not in the window: it took `{} as Record<…>` inside reactive({ … }) for needless, where only the `as` gives the
  // store's field its type (vue-tsc failed once they were removed); and it reads a .vue file's script without Vue's plugin.
  { files: ['src/renderer/**'], rules: { '@typescript-eslint/no-unnecessary-type-assertion': 'off' } },
);
