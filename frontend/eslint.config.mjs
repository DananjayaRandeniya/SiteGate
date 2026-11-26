import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: jsxA11y.flatConfigs.recommended.rules },
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
