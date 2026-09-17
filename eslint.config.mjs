import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-dev/**",
      ".next-quality/**",
      "test-results/**",
      "playwright-report/**",
      "out/**",
      "build/**",
      "outputs/**",
      "next-env.d.ts",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/**", "**/app/**"],
              message: "Las rutas componen módulos; los módulos no deben importar rutas de Next.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/**/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**",
                "**/app/**",
                "@/components/**",
                "**/components/**",
                "@/hooks/**",
                "**/hooks/**",
                "react",
                "react-dom",
                "react-dom/**",
              ],
              message: "Los servicios del dominio no deben depender de rutas, componentes o hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**", "**/app", "**/app/**"],
              message: "La UI compartida no debe depender de rutas.",
            },
            {
              group: ["@/features/*", "@/features/**", "**/features", "**/features/**"],
              message: "La UI compartida no debe depender de reglas de negocio.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/*",
                "@/components/**",
                "@/features/*",
                "@/features/**",
                "@/hooks/*",
                "@/hooks/**",
                "**/components",
                "**/components/**",
                "**/features",
                "**/features/**",
                "**/hooks",
                "**/hooks/**",
              ],
              message: "El transporte de servidor no debe importar código de interfaz o hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      // React Compiler is not enabled. Keep rules-of-hooks and exhaustive-deps active.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default config;
