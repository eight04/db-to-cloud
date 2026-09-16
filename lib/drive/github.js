/* global self */
const base64 = require("universal-base64");

const {createRequest} = require("../request");

// Also covers GHES, Gitea, and Forgejo — same Contents API, so `apiBase`
// alone is enough to target any of them.
function createDrive({
  userAgent = "db-to-cloud",
  apiBase,
  owner,
  repo,
  branch,
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch
}) {
  if (!owner || !repo) {
    throw new Error("owner and repo are required");
  }
  apiBase = (apiBase || "https://api.github.com").replace(/\/+$/, "");
  // Unset means the repo's default branch: omit ?ref= / branch entirely.
  branch = branch || null;
  const request = createRequest({fetch, getAccessToken, cooldown: 1000});
  const shaCache = new Map;
  return {
    name: "github",
    get,
    put,
    post,
    delete: delete_,
    list,
    checkRepoExists,
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
      // Plain JSON — Gitea/Forgejo don't honor GitHub's vnd.github.v3+json.
      args.headers["Accept"] = "application/json";
    }
    args.path = `${apiBase}${args.path}`;
    return request(args);
  }

  function contentsPath(file, ref = false) {
    const encoded = file.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    const path = `/repos/${owner}/${repo}/contents${encoded ? `/${encoded}` : ""}`;
    return ref && branch ? `${path}?ref=${encodeURIComponent(branch)}` : path;
  }

  // A 404 from contents is ambiguous (missing repo vs. empty path).
  // list()/get() don't call this — they let a plain 404 propagate.
  async function checkRepoExists() {
    try {
      await requestAPI({path: `/repos/${owner}/${repo}`});
      return true;
    } catch (err) {
      if (err.code === 404) return false;
      throw err;
    }
  }

  async function list(file) {
    // FIXME: This API has an upper limit of 1,000 files for a directory. If you need to retrieve more files, use the Git Trees API.
    const result = await requestAPI({path: contentsPath(file, true)});
    const names = [];
    for (const item of result) {
      names.push(item.name);
      shaCache.set(item.path, item.sha);
    }
    return names;
  }

  async function get(file) {
    // FIXME: This API supports files up to 1 megabyte in size.
    const result = await requestAPI({path: contentsPath(file, true)});
    shaCache.set(result.path, result.sha);
    return base64.decode(result.content);
  }

  async function put(file, data, overwrite = true) {
    // Uses the cached sha if we have one. Otherwise writes as a create;
    // on conflict (file already existed), fetches the real sha and retries once.
    const sha = shaCache.get(file);
    function write(sha) {
      const params = {message: "", content: base64.encode(data)};
      if (branch) params.branch = branch;
      if (sha) params.sha = sha;
      return requestAPI({
        method: "PUT",
        path: contentsPath(file),
        contentType: "application/json",
        body: JSON.stringify(params)
      });
    }
    try {
      const result = await write(sha);
      // Only recorded once the write actually succeeded.
      shaCache.set(file, result.content.sha);
    } catch (err) {
      if (overwrite && sha === undefined && (err.code === 422 || err.code === 409)) {
        const existing = await requestAPI({path: contentsPath(file, true)});
        shaCache.set(existing.path, existing.sha);
        const result = await write(existing.sha);
        shaCache.set(file, result.content.sha);
        return;
      }
      if (!overwrite && (err.code === 422 || err.code === 409)) {
        // 422/409 on a no-sha write means the file already exists.
        err.code = "EEXIST";
      }
      throw err;
    }
  }

  function post(file, data) {
    return put(file, data, false);
  }

  async function delete_(file) {
    try {
      let sha = shaCache.get(file);
      if (!sha) {
        // Not cached: fetch it once. Not a retry loop.
        await get(file);
        sha = shaCache.get(file);
      }
      await requestAPI({
        method: "DELETE",
        path: contentsPath(file),
        contentType: "application/json",
        body: JSON.stringify({message: "", sha, ...(branch ? {branch} : {})})
      });
      shaCache.delete(file);
    } catch (err) {
      if (err.code === 404) {
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
