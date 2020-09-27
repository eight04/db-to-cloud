/* global self */
const {createRequest} = require("../request");

function createDrive({
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch
}) {
  const request = createRequest({fetch, getAccessToken});
  return {
    name: "dropbox",
    get,
    put,
    post,
    delete: delete_,
    list
  };
  
  function requestRPC({path, body, ...args}) {
    return request({
      method: "POST",
      path: `https://api.dropboxapi.com/2/${path}`,
      contentType: "application/json",
      body: JSON.stringify(body),
      ...args
    });
  }
  
  async function list(file) {
    const names = [];
    let result = await requestRPC({
      path: "files/list_folder",
      body: {
        path: `/${file}`
      }
    });
    for (const entry of result.entries) {
      names.push(entry.name);
    }
    if (!result.has_more) {
      return names;
    }
    while (result.has_more) {
      result = await requestRPC({
        path: "files/list_folder/continue",
        body: {
          cursor: result.cursor
        }
      });
      for (const entry of result.entries) {
        names.push(entry.name);
      }
    }
    return names;
  }
  
  function stringifyParams(obj) {
    const params = new URLSearchParams;
    params.set("arg", JSON.stringify(obj));
    return params.toString();
  }
  
  async function get(file) {
    const params = {
      path: `/${file}`
    };
    try {
      return await request({
        path: `https://content.dropboxapi.com/2/files/download?${stringifyParams(params)}`,
        format: "text"
      });
    } catch (err) {
      if (err.code === 409 && err.message.includes("not_found")) {
        err.code = "ENOENT";
      }
      throw err;
    }
  }
  
  async function put(file, data, mode = "overwrite") {
    const params = {
      path: `/${file}`,
      mode,
      autorename: false,
      mute: true
    };
    await request({
      path: `https://content.dropboxapi.com/2/files/upload?${stringifyParams(params)}`,
      method: "POST",
      contentType: "application/octet-stream",
      body: data
    });
  }
  
  async function post(file, data) {
    try {
      return await put(file, data, "add");
    } catch (err) {
      if (err.code === 409 && err.message.includes("conflict")) {
        err.code = "EEXIST";
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    try {
      await requestRPC({
        path: "files/delete_v2",
        body: {
          path: `/${file}`
        }
      });
    } catch (err) {
      if (err.code === 409 && err.message.includes("not_found")) {
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
