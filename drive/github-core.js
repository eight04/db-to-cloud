const Octokit = require("@octokit/rest");
const throttlingPlugin = require("@octokit/plugin-throttling");

const ThrottledOctokit = Octokit.plugin(throttlingPlugin);

module.exports = {
  Octokit: ThrottledOctokit
};
