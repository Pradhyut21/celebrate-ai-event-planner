import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', Buffer: 'readonly' } },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: { ...reactHooks.configs.recommended.rules, ...jsxA11y.configs.recommended.rules },
  },
);
