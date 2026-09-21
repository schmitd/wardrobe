import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import wardrobe from "./validation/confect-eslint.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["confect/**/*.ts"],
    ignores: ["**/*.test.ts", "confect/_generated/**"],
    plugins: { wardrobe },
    rules: { "wardrobe/storage-authority": "error" },
  },
  {
    files: ["confect/*.impl.ts"],
    plugins: { wardrobe },
    rules: { "wardrobe/bounded-effect-reads": "error" },
  },
  {
    files: ["src/server/**/*.ts", "src/services/**/*.ts"],
    ignores: ["**/*.test.ts"],
    plugins: { wardrobe },
    rules: { "wardrobe/server-direction": "error", "wardrobe/shared-provider-runtime": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "confect/_generated/**",
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
