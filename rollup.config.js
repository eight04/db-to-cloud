// import analyzer from "rollup-plugin-analyzer";
import resolve from "rollup-plugin-node-resolve";
import cjs from "rollup-plugin-cjs-es";
import alias from "rollup-plugin-alias";
import babel from "rollup-plugin-babel";
import {terser} from "rollup-plugin-terser";
import globals from "rollup-plugin-external-globals";

function config({output, plugins = []}) {
  return {
    input: "index.js",
    output: {
      // file: "dist/db-to-cloud.js",
      format: "iife",
      name: "dbToCloud",
      ...output
    },
    plugins: [
      alias({
        entries: [{
          find: "./fs-drive",
          replacement: require.resolve("./shim/empty")
        }]
      }),
      resolve({
        browser: true
      }),
      cjs({nested: true}),
      globals({
        "dropbox": "dropbox",
        "@octokit/plugin-throttling": "octokitPluginThrottling",
        "@octokit/rest": "Octokit"
      }),
      babel(),
      ...plugins
      // terser(),
      // analyzer()
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
