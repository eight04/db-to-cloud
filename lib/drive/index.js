const fsDrive = require("./fs-drive");
const github = require("./github");
const dropbox = require("./dropbox");
const onedrive = require("./onedrive");
const google = require("./google");
const webdav = require("./webdav");

module.exports = {
  fsDrive,
  github,
  dropbox,
  onedrive,
  google,
  webdav
};
