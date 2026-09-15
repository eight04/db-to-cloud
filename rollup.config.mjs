import resolve from "@rollup/plugin-node-resolve";
import cjs from "rollup-plugin-cjs-es";
import alias from "@rollup/plugin-alias";
import {babel} from "@rollup/plugin-babel";
import inject from "@rollup/plugin-inject";
import terser from "@rollup/plugin-terser";
import re from "rollup-plugin-re";

import {fileURLToPath} from "url";

function config({output, plugins = []}) {
  return {
    input: "index.js",
    output: {
      format: "iife",
      name: "dbToCloud",
      sourcemap: true,
      ...output
    },
    plugins: [
      alias({
        entries: {
          "./fs-drive": fileURLToPath(import.meta.resolve("./shim/empty.js")),
          "path": fileURLToPath(import.meta.resolve("./shim/path.js")),
        }
      }),
      resolve({
        browser: true
      }),
      re({
        patterns: [
          {
            test: /Object\.defineProperty\(\s*(exports|module\.exports)\s*,\s*['"]__esModule['"][^)]+\)/,
            replace: ""
          }
        ]
      }),
      cjs({nested: true}),
      babel({
        babelHelpers: "bundled"
      }),
      inject({
        globalThis: fileURLToPath(import.meta.resolve("./shim/globalThis.js"))
      }),
      ...plugins
    ]
  };
}

export default [
  config({
    output: {
      file: "dist/db-to-cloud.js"
    }
  }),
  config({
    output: {
      file: "dist/db-to-cloud.min.js"
    },
    plugins: [
      terser()
    ]
  })
];
