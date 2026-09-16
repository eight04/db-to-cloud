const fetch = require("make-fetch-happen");

const {github} = require("../..").drive;

module.exports = {
  name: "github",
  valid: () => process.env.GITHUB_ACCESS_TOKEN,
  get() {
    // GITHUB_API_BASE targets a self-hosted GHES/Gitea/Forgejo instead of
    // github.com — verified to work identically against a real Gitea
    // instance (PUT-without-sha creates there too).
    const drive = github({
      owner: process.env.GITHUB_OWNER,
      repo: "_db_to_cloud_test",
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
