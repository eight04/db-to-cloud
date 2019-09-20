function createDrive({
  getAccessToken,
  clientId,
  fetch: _fetch = fetch
}) {
  return {
    name: "onedrive",
    get,
    put,
    post,
    delete: delete_,
    list
  };
  
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
