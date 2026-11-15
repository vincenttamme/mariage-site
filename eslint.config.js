import globals from 'globals';

export default [
  { ignores: ['dress-code/scene.bundle.js', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['dress-code/*.js', 'scripts/*.mjs', 'tests/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-duplicate-case': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
];
