const fetch = require("make-fetch-happen");

const {github} = require("../..").drive;

module.exports = {
  name: "github",
  valid: () => process.env.GITHUB_ACCESS_TOKEN,
  get() {
    const drive = github({
      owner: process.env.GITHUB_OWNER,
      repo: "_db_to_cloud_test",
      getAccessToken: () => process.env.GITHUB_ACCESS_TOKEN,
      fetch
    });
    if (!this.drive) {
      this.drive = drive;
    }
    return drive;
  },
  async after() {
    for (const path of this.drive.shaCache.keys()) {
      await this.drive.delete(path);
    }
  }
};
