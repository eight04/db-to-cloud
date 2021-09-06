const {makeDir} = require("tempdir-yaml");

const {fsDrive} = require("../..").drive;

module.exports = {
  name: "fs-drive",
  valid: () => true,
  async before() {
    this.dir = await makeDir();
  },
  async after() {
    await this.dir.cleanup();
  },
  get() {
    return fsDrive({
      folder: this.dir.resolve(".")
    });
  }
};
