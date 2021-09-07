const fetch = require("make-fetch-happen");
const { DOMParser } = require('@xmldom/xmldom');
// const {WebDAVServer, HTTPBasicAuthentication, ResourceType} = require("webdav-server").v2;
// too much issues with this lib

const {webdav} = require("../..").drive;

module.exports = {
  name: "webdav",
  valid: () => process.env.WEBDAV_USER,
  get() {
    this.drive = webdav({
      username: process.env.WEBDAV_USER,
      password: process.env.WEBDAV_PASS,
      url: process.env.WEBDAV_URL,
      fetch,
      DOMParser
    });
    return this.drive;
  },
  async after() {
    await this.drive.delete("docs");
    await this.drive.delete("changes");
    await this.drive.delete("meta.json");
  }
};
