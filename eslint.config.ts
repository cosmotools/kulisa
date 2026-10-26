// ESLint: only what tsc cannot see, with the types (docs/testing.md, Lint). Not the presets: they flag every `any` from
// JSON and IPC and the templates' formatting, about 2400 places and no bug.
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

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
        projectService: { allowDefaultProject: ['eslint.config.ts', 'vite.config.mts'] },
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
      'no-restricted-syntax': ['error', { selector: 'ExportAllDeclaration', message: 'Re-export by name, not export *.' }],
    },
  },
  // Not in the window: it took `{} as Record<…>` inside reactive({ … }) for needless, where only the `as` gives the
  // store's field its type (vue-tsc failed once they were removed); and it reads a .vue file's script without Vue's plugin.
  { files: ['src/renderer/**'], rules: { '@typescript-eslint/no-unnecessary-type-assertion': 'off' } },
);
