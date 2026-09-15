import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist-extension/*", "build", "chrome", "dist", "coverage", "shim"]),
  {
    languageOptions: {
      globals: {
        // ...globals.browser,
        ...globals.node,
      }
    },
    plugins: {js},
    extends: ["js/recommended"],
  },
  // {
  //   files: ["test/**/*.js"],
  //   languageOptions: {
  //     globals: {
  //       ...globals.node,
  //     }
  //   }
  // }
]);
