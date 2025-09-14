// eslint.config.mjs (Flat config for Next.js 15)
import next from 'eslint-config-next';

export default [
  ...next,
  {
    rules: {
      // Allow pragmatic any’s in API/middleware glue code
      '@typescript-eslint/no-explicit-any': 'off',

      // Don’t fail build for unused vars; warn instead (prefix _ to silence)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // We intentionally manage effects; don’t fail build on this rule
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
