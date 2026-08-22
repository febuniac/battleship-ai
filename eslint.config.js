import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.browser,
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },
  {
    // The game engine and AI must stay pure: no DOM, no React, no ambient randomness.
    files: ['src/engine/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'The engine must not touch the DOM.' },
        { name: 'document', message: 'The engine must not touch the DOM.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the injected seeded RNG instead.' },
        { object: 'Date', property: 'now', message: 'The engine must stay deterministic.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', '../ui/*', '**/ui/**'] },
      ],
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  { files: ['scripts/**/*.ts'], languageOptions: { globals: globals.node } },
);
