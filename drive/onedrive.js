/* global fetch */
const {CustomError} = require("./error");

function createDrive({
  getAccessToken,
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
  
  async function query({method = "GET", path, headers, format = "json", ...args}) {
    const res = await _fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot${path}`, {
      method,
      headers: {
        "Authorization": `bearer ${await getAccessToken()}`,
        ...headers
      },
      ...args
    });
    if (!res.ok) {
      const {error} = await res.json();
      throw new CustomError(error.code, error);
    }
    if (format) {
      return await res[format]();
    }
  }
  
  async function list(file) {
    if (file) {
      file = `:/${file}:`;
    }
    const result = await query({
      path: `${file}/children?select=name`
    });
    return result.value.map(i => i.name);
  }
  
  async function get(file) {
    try {
      return await query({
        path: `:/${file}:/content`,
        format: "text"
      });
    } catch (err) {
      if (err.code === "itemNotFound") {
        err.code = "ENOENT";
      }
      throw err;
    }
  }
  
  async function put(file, data) {
    await query({
      method: "PUT",
      path: `:/${file}:/content`,
      headers: {
        "Content-Type": "text/plain"
      },
      body: data
    });
  }
  
  async function post(file, data) {
    try {
      await query({
        method: "PUT",
        path: `:/${file}:/content?@microsoft.graph.conflictBehavior=fail`,
        headers: {
          "Content-Type": "text/plain"
        },
        body: data
      });
    } catch (err) {
      if (err.code === "nameAlreadyExists") {
        err.code = "EEXIST";
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    try {
      await query({
        method: "DELETE",
        path: `:/${file}:`,
        format: null
      });
    } catch (err) {
      if (err.code === "itemNotFound") {
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
