/* global self */
const base64 = require("universal-base64");

const {createRequest} = require("../request");

function createDrive({
  userAgent = "db-to-cloud",
  owner,
  repo,
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch
}) {
  const request = createRequest({fetch, getAccessToken, cooldown: 1000});
  const shaCache = new Map;
  return {
    name: "github",
    get,
    put,
    post,
    delete: delete_,
    list,
    shaCache
  };
  
  function requestAPI(args) {
    if (!args.headers) {
      args.headers = {};
    }
    if (!args.headers["User-Agent"]) {
      args.headers["User-Agent"] = userAgent;
    }
    if (!args.headers["Accept"]) {
      args.headers["Accept"] = "application/vnd.github.v3+json";
    }
    args.path = `https://api.github.com${args.path}`;
    return request(args);
  }
  
  async function list(file) {
    // FIXME: This API has an upper limit of 1,000 files for a directory. If you need to retrieve more files, use the Git Trees API.
    const result = await requestAPI({
      path: `/repos/${owner}/${repo}/contents/${file}`
    });
    const names = [];
    for (const item of result) {
      names.push(item.name);
      shaCache.set(item.path, item.sha);
    }
    return names;
  }
  
  async function get(file) {
    // FIXME: This API supports files up to 1 megabyte in size.
    const result = await requestAPI({
      path: `/repos/${owner}/${repo}/contents/${file}`
    });
    shaCache.set(result.path, result.sha);
    return base64.decode(result.content);
  }
  
  async function put(file, data, overwrite = true) {
    const params = {
      message: "",
      content: base64.encode(data)
    };
    if (overwrite && shaCache.has(file)) {
      params.sha = shaCache.get(file);
    }
    const args = {
      method: "PUT",
      path: `/repos/${owner}/${repo}/contents/${file}`,
      contentType: "application/json",
      body: JSON.stringify(params)
    };
    let retried = false;
    let result;
    while (!result) {
      try {
        result = await requestAPI(args);
      } catch (err) {
        if (err.code !== 422 || !err.message.includes("\\\"sha\\\" wasn't supplied")) {
          throw err;
        }
        if (!overwrite || retried) {
          err.code = "EEXIST";
          throw err;
        }
        await get(file);
      }
      retried = true;
    }
    shaCache.set(file, result.content.sha);
  }
  
  function post(file, data) {
    return put(file, data, false);
  }
  
  async function delete_(file) {
    try {
      let sha = shaCache.get(file);
      if (!sha) {
        await get(file);
        sha = shaCache.get(file);
      }
      await requestAPI({
        method: "DELETE",
        path: `/repos/${owner}/${repo}/contents/${file}`,
        body: JSON.stringify({
          message: "",
          sha
        })
      });
    } catch (err) {
      if (err.code === 404) {
        return;
      }
      // FIXME: do we have to handle 422 errors?
      throw err;
    }
  }
}

module.exports = createDrive;
