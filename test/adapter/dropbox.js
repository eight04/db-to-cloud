const fetch = require("make-fetch-happen");

const {dropbox} = require("../..").drive;

module.exports = {
  name: "dropbox",
  valid: () => process.env.DROPBOX_ACCESS_TOKEN,
  get() {
    const drive = dropbox({
      fetch,
      getAccessToken: () => process.env.DROPBOX_ACCESS_TOKEN
    });
    if (!this.drive) {
      this.drive = drive;
    }
    return drive;
  },
  async after() {
    await this.drive.delete("docs");
    await this.drive.delete("changes");
    await this.drive.delete("meta.json");
  }
};
