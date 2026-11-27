import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Flat config, because Next 16 removed `next lint` and eslint-config-next 16
// ships only flat configs (ESLint 9). Rules match the old .eslintrc.json.
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) turned
      // on the React Compiler rules. They flag ~30 existing effects and refs
      // that were legal under 5.x; each one is a behaviour change to review on
      // its own, not something to fold into a dependency bump. Off until that
      // pass is done.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    ignores: ['.next/**', '.next-*/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
