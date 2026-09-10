import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
const config = [
  { ignores: ['node_modules/**', '.next/**', '.next-dev/**', 'out/**', 'build/**', 'outputs/**', 'next-env.d.ts'] },
  ...nextVitals,
  ...nextTypescript,
  { rules: {
    // React Compiler is not enabled. Keep rules-of-hooks and exhaustive-deps active.
    "react-hooks/set-state-in-effect": "off", "react-hooks/refs": "off",
    "react-hooks/purity": "off", "react-hooks/immutability": "off",
    "react-hooks/static-components": "off", "react-hooks/incompatible-library": "off",
  } },
];

export default config;
