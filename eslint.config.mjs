import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // External API responses are genuinely untyped at runtime
      "@typescript-eslint/no-explicit-any": "off",
      // require() is used in one server utility file
      "@typescript-eslint/no-require-imports": "off",
      // img tags are fine for external flag/photo URLs (CDN-hosted, no Next image domain needed)
      "@next/next/no-img-element": "off",
      // Unused vars — keep warnings but not errors
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);

export default eslintConfig;
