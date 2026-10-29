import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  URL: 'readonly',
  Buffer: 'readonly',
};

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: 'error',
    },
  },
  {
    // ADR-003 §6: core is pure. No I/O, no time, no randomness, no environment.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./)',
              message: '@wrpguard/core may only import its own modules (ADR-003 §6).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'EventSource',
        'process',
        'require',
        'Date',
        'performance',
        'setTimeout',
        'setInterval',
        'crypto',
        'globalThis',
      ],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random' }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: nodeGlobals },
  },
);
