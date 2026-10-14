const fetch = require("make-fetch-happen");

const {github} = require("../..").drive;

module.exports = {
  drives: [],
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
    this.drives.push(drive);
    return drive;
  },
  async after() {
    for (const drive of this.drives) {
      for (const path of drive.shaCache.keys()) {
        if (validPath(path)) {
          await drive.delete(path);
        }
      }
    }
  }
};

function validPath(path) {
  // don't delete files not created by this test suite, to avoid deleting important files in the repo
  // FIXME: now we have to maintain this list of files that are created by the test suite, which is not ideal. We should find a better way to track which files are created by the test suite.
  return /^(meta\.json|lock\.json|docs\/.*|changes\/.*)$/.test(path);
}
