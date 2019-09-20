/* global FileReader fetch */
const {CustomError} = require("./error");

function blobToText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert blob object to text"));
    };
    reader.readAsText(blob);
  });
}

function testErrorSummary(err, text) {
  const error = err.error;
  if (typeof error === "string") {
    return error.includes(text);
  }
  return error.error_summary && error.error_summary.includes(text);
}

function createDrive({
  getAccessToken,
  clientId,
  fetch: _fetch = fetch
}) {
  let dropbox;
  return {
    name: "dropbox",
    init,
    get,
    put,
    post,
    delete: delete_,
    list
  };
  
  async function init() {
    const {Dropbox} = await Promise.resolve(require("dropbox"));
    dropbox = new Dropbox({
      fetch: _fetch,
      clientId
    });
    dropbox.setAccessToken(await getAccessToken(dropbox));
  }
  
  async function list(file) {
    const names = [];
    let result = await dropbox.filesListFolder({
      path: `/${file}`
    });
    for (const entry of result.entries) {
      names.push(entry.name);
    }
    if (!result.has_more) {
      return names;
    }
    let cursor = result.cursor;
    while (result.has_more) {
      result = await dropbox.filesListFolderContinue({cursor});
      cursor = result.cursor;
      for (const entry of result.entries) {
        names.push(entry.name);
      }
    }
    return names;
  }
  
  async function get(file) {
    let result;
    try {
      result = await dropbox.filesDownload({
        path: `/${file}`
      });
    } catch (err) {
      if (testErrorSummary(err, "not_found")) {
        throw new CustomError("ENOENT", err);
      }
      throw err;
    }
    if (result.fileBinary) {
      return result.fileBinary.toString();
    }
    return await blobToText(result.fileBlob);
  }
  
  async function put(file, data) {
    await dropbox.filesUpload({
      contents: data,
      path: `/${file}`,
      mode: "overwrite",
      autorename: false
    });
  }
  
  async function post(file, data) {
    try {
      await dropbox.filesUpload({
        contents: data,
        path: `/${file}`,
        mode: "add",
        autorename: false
      });
    } catch (err) {
      if (testErrorSummary(err, "conflict")) {
        throw new CustomError("EEXIST", err);
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    try {
      await dropbox.filesDelete({
        path: `/${file}`
      });
    } catch (err) {
      if (testErrorSummary(err, "not_found")) {
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
