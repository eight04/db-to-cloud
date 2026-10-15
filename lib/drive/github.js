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
  fetch = globalThis.fetch
}) {
  if (!owner || !repo) {
    throw new Error("owner and repo are required");
  }
  apiBase = (apiBase || "https://api.github.com").replace(/\/+$/, "");
  // Unset means the repo's default branch: omit ?ref= / branch entirely.
  branch = branch || null;
  const request = createRequest({fetch, getAccessToken, cooldown: 1000});
  const shaCache = new Map;
  let shaCacheTs = 0;
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
    await updateShaCache(file);
    const prefix = file ? `${file}/` : "";
    const names = [];
    for (const path of shaCache.keys()) {
      if (path.startsWith(prefix)) {
        const name = path.slice(prefix.length);
        if (name && !name.includes("/")) {
          names.push(name);
        }
      }
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
    const params = {message: "", content: base64.encode(data)};
    const path = contentsPath(file);
    if (branch) params.branch = branch;
    let retried = 0;
    while (true) {
      if (overwrite && shaCache.has(file)) {
        params.sha = shaCache.get(file);
      }
      try {
        const result = await requestAPI({
          method: "PUT",
          path,
          contentType: "application/json",
          body: JSON.stringify(params)
        });
        // Only recorded once the write actually succeeded.
        shaCache.set(file, result.content.sha);
        return;
      } catch (err) {
        if (err.code === 422 || err.code === 409) {
          if (overwrite && retried < 1 && await updateShaCache(file)) {
            retried++;
            continue;
          }
          if (!overwrite) {
            // 422/409 on a no-sha write means the file already exists.
            err.code = "EEXIST";
          }
        }
        throw err;
      }
    }
  }

  async function updateShaCache(file) {
    // It makes no sense to refresh the cache too often, something is probably wrong.
    const COOL_DOWN = 0 * 1000;
    const now = Date.now();
    if (now - shaCacheTs < COOL_DOWN) {
      return false;
    }
    shaCacheTs = now;
    const oldSha = shaCache.get(file);
    shaCache.clear();

    // use tree api
    // FIXME: is it safe to request the entire tree from root? what if the user stores other stuff in the repo?
    for (let i = 0;; i++) {
      const result = await requestAPI({path: `/repos/${owner}/${repo}/git/trees/${branch || "HEAD"}?recursive=1&page=${i + 1}`});
      for (const item of result.tree) {
        if (shaCache.has(item.path)) {
          throw new Error(`Duplicate path in git tree: ${item.path}`);
        }
        shaCache.set(item.path, item.sha);
      }
      if (!result.truncated) {
        break;
      }
      if (!result.page) {
        throw new Error("Git tree is truncated; cannot update sha cache");
      }
    }
    return oldSha !== shaCache.get(file);
  }

  function post(file, data) {
    return put(file, data, false);
  }

  async function delete_(file) {
    const path = contentsPath(file);
    let sha = shaCache.get(file);
    if (!sha) {
      await updateShaCache(file);
      sha = shaCache.get(file);
      if (!sha) {
        // The file doesn't exist, nothing to delete.
        return;
      }
    }
    let retried = 0;
    while (true) {
      try {
        await requestAPI({
          method: "DELETE",
          path,
          contentType: "application/json",
          body: JSON.stringify({message: "", sha, ...(branch ? {branch} : {})})
        });
        shaCache.delete(file);
        return;
      } catch (err) {
        if (err.code === 404) {
          return;
        }
        if (retried < 1 && (err.code === 409 || err.code === 422) && await updateShaCache(file)) { // NOTE we get 422 error on gitea
          const newSha = shaCache.get(file);
          if (!newSha) {
            // The file doesn't exist, nothing to delete.
            return;
          }
          sha = newSha;
          retried++;
          continue;
        }
        throw err;
      }
    }
  }
}

module.exports = createDrive;
