import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.e2e-state/**',
      'packages/database/migrations/**',
    ],
  },
  js.configs.recommended,

  // TypeScript con controlli che richiedono i tipi (promise non gestite, any impliciti, ...).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // Frontend: hooks di React e accessibilità.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      // Il pattern <label><input/><span><span>testo</span></span></label> è accessibile.
      'jsx-a11y/label-has-associated-control': ['error', { depth: 4 }],
    },
  },

  // Backend: runtime Cloudflare Workers.
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },

  // Script e configurazioni in JavaScript.
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  // Script servito al browser (tema prima del primo paint).
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },

  // I test usano pattern che il typed-linting segnala senza reale rischio (mock, any di risposte JSON).
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
