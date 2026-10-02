const targets = {
  chrome: "49"
}
const presets = [
  [
    "@babel/env",
    {
      targets,
      // https://github.com/facebook/regenerator/issues/276
      include: ["transform-template-literals"],
      exclude: ["transform-regenerator"],
    },
  ],
];
// const plugins = [
//   [
//     // FIXME: corejs3 doesn't work well with esm
//     // https://github.com/zloirock/core-js/issues/385
//     "polyfill-corejs3",
//     {
//       method: "usage-pure",
//     }
//   ]
// ]

module.exports = { presets, targets };
