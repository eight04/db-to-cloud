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
      bugfixes: true,
    },
  ],
];

module.exports = { presets, targets };
