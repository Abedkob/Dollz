import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  {
    // Ported browser-only WebGL modules (see apps/web/src/lib/doll-hero/DollHero.js
    // header comments) -- plain JS, so `no-undef` needs the browser globals they use.
    files: ['apps/web/src/lib/doll-hero/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        matchMedia: 'readonly',
        console: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        customElements: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        WebGL2RenderingContext: 'readonly',
      },
    },
  },
);
