const fetch = require("make-fetch-happen");

const {github} = require("../..").drive;

module.exports = {
  name: "github",
  valid: () => process.env.GITHUB_ACCESS_TOKEN,
  get() {
    // GITHUB_API_BASE targets a self-hosted GHES/Gitea/Forgejo instead of
    // github.com — uses `token` auth there since an OAuth app generally
    // can't be pre-registered against an arbitrary self-hosted instance.
    // GITHUB_CREATE_METHOD lets a Gitea/Forgejo run set createMethod: "post".
    const apiBase = process.env.GITHUB_API_BASE;
    const drive = github({
      owner: process.env.GITHUB_OWNER,
      repo: "_db_to_cloud_test",
      apiBase,
      createMethod: process.env.GITHUB_CREATE_METHOD,
      ...apiBase
        ? {token: process.env.GITHUB_ACCESS_TOKEN}
        : {getAccessToken: () => process.env.GITHUB_ACCESS_TOKEN},
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
