import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const corePurity = {
  files: ["src/core/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react/*", "next", "next/*"],
            message:
              "src/core debe permanecer puro: sin React ni Next. Los adaptadores son los que dependen del núcleo, no al revés.",
          },
          {
            group: ["web-push"],
            message:
              "src/core no puede depender de web-push. Usa el puerto PushSender y deja que un adaptador implemente web-push.",
          },
          {
            group: ["@upstash/*"],
            message:
              "src/core no puede depender de Upstash. Usa el puerto SubscriptionStore y deja que un adaptador implemente Redis.",
          },
          {
            group: ["localStorage", "sessionStorage"],
            message:
              "src/core no puede acceder al navegador. Usa los puertos de repositorio y deja que un adaptador use localStorage.",
          },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      ...["window", "document", "localStorage", "sessionStorage", "navigator", "Notification"].map(
        (name) => ({
          name,
          message:
            "src/core no puede usar APIs del navegador. Declara un puerto y delega en un adaptador.",
        }),
      ),
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  corePurity,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generado por Serwist después del build:
    "public/sw*",
  ]),
]);

export default eslintConfig;
