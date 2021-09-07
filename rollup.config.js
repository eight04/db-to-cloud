import resolve from "@rollup/plugin-node-resolve";
import cjs from "rollup-plugin-cjs-es";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import {terser} from "rollup-plugin-terser";
import re from "rollup-plugin-re";

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
          "./fs-drive": require.resolve("./shim/empty"),
          "path": require.resolve("./shim/path")
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
