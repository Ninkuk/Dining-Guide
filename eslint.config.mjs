import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Default ignores of eslint-config-next, restated explicitly.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "components/ui/**"]),
  // Type-aware rules: only run on TS files in the project graph.
  // Hand-picked from typescript-eslint's recommended-type-checked set —
  // these catch real async bugs that pure tsc --noEmit misses.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      // `no-misused-promises` is kept as a warning because the most common
      // violation (async handlers passed to `onClick`/`onSelect`) is a
      // widespread React idiom that's only *technically* unsafe — handler
      // bodies use toast/error state for failures, not the swallowed
      // rejection. Promoting to "error" can be revisited after a cleanup
      // pass that introduces a `voidAsync` helper or similar.
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
]);

export default eslintConfig;
