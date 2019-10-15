/* global self */
const {createRequest} = require("../request");

function createDrive({
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch
}) {
  const request = createRequest({fetch, getAccessToken});
  return {
    name: "onedrive",
    get,
    put,
    post,
    delete: delete_,
    list
  };
  
  async function query(args) {
    args.path = `https://graph.microsoft.com/v1.0/me/drive/special/approot${args.path}`;
    return await request(args);
  }
  
  async function list(file) {
    if (file) {
      file = `:/${file}:`;
    }
    let result = await query({
      path: `${file}/children?select=name`
    });
    let files = result.value.map(i => i.name);
    while (result["@odata.nextLink"]) {
      result = await request({
        path: result["@odata.nextLink"]
      });
      files = files.concat(result.value.map(i => i.name));
    }
    return files;
  }
  
  async function get(file) {
    return await query({
      path: `:/${file}:/content`,
      format: "text"
    });
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
      if (err.code === 409 && err.message.includes("nameAlreadyExists")) {
        err.code = "EEXIST";
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    try {
      await query({
        method: "DELETE",
        path: `:/${file}:`
      });
    } catch (err) {
      if (err.code === 404) {
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
