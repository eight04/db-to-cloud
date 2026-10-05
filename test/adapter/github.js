const fetch = require("make-fetch-happen");

const {github} = require("../..").drive;

module.exports = {
  name: "github",
  valid: () => process.env.GITHUB_ACCESS_TOKEN,
  get() {
    // GITHUB_API_BASE targets a self-hosted GHES/Gitea/Forgejo instead of github.com.
    const drive = github({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO || "_db_to_cloud_test",
      branch: process.env.GITHUB_BRANCH || undefined,
      apiBase: process.env.GITHUB_API_BASE || undefined,
      getAccessToken: () => ({scheme: "token", param: process.env.GITHUB_ACCESS_TOKEN}),
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
