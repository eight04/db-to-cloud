/* global self */
const base64 = require("universal-base64");

const {createRequest} = require("../request");

// Also covers GHES, Gitea, and Forgejo — they implement the same Contents
// API, so `apiBase` is enough to target any of them; no per-host branching.
function createDrive({
  userAgent = "db-to-cloud",
  apiBase = "https://api.github.com",
  owner,
  repo,
  branch = "main",
  token,
  createMethod = "put",
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch
}) {
  if (!owner || !repo) {
    throw new Error("owner and repo are required");
  }
  // `|| default`, not just the destructuring default, because a caller-side
  // form field or env var left blank (e.g. `GITHUB_API_BASE=`, or an empty
  // "branch" input in a settings UI) comes through as "", which skips a
  // destructuring default (only `undefined` triggers those) — apiBase would
  // otherwise build a request with no host, and branch an empty ?ref=.
  apiBase = (apiBase || "https://api.github.com").replace(/\/+$/, "");
  createMethod = createMethod || "put";
  branch = branch || "main";
  const request = createRequest({fetch, getAccessToken: token ? undefined : getAccessToken, cooldown: 1000});
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
      // Plain JSON rather than GitHub's vnd.github.v3+json — Gitea/Forgejo
      // have no reason to honor a GitHub-specific media type.
      args.headers["Accept"] = "application/json";
    }
    if (token && !args.headers["Authorization"]) {
      args.headers["Authorization"] = `token ${token}`;
    }
    // put()/delete_() re-read `sha` right before writing to avoid a
    // stale-sha conflict; a cached read would defeat that.
    args.cache = "no-store";
    args.path = `${apiBase}${args.path}`;
    return request(args);
  }

  function contentsPath(file) {
    const encoded = file.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return `/repos/${owner}/${repo}/contents${encoded ? `/${encoded}` : ""}`;
  }

  function contentsPathForRead(file) {
    return `${contentsPath(file)}?ref=${encodeURIComponent(branch)}`;
  }

  // A 404 from the contents endpoint is ambiguous: missing repo vs. repo
  // exists but this path is simply empty. This disambiguates. Never creates
  // the repo itself.
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
    let result;
    try {
      result = await requestAPI({path: contentsPathForRead(file)});
    } catch (err) {
      if (err.code === 404) {
        if (!await checkRepoExists()) {
          const notFound = new Error(
            `Repository "${owner}/${repo}" was not found, or the token does not have access to it. ` +
              `Create the repository first, then make sure the token can read and write its contents.`
          );
          notFound.code = "ENOREPO";
          throw notFound;
        }
        return [];
      }
      throw err;
    }
    const names = [];
    for (const item of result) {
      names.push(item.name);
      shaCache.set(item.path, item.sha);
    }
    return names;
  }

  async function get(file) {
    // FIXME: This API supports files up to 1 megabyte in size.
    const result = await requestAPI({path: contentsPathForRead(file)});
    shaCache.set(result.path, result.sha);
    return base64.decode(result.content);
  }

  async function put(file, data, overwrite = true) {
    // GitHub uses PUT for both create and update; Gitea/Forgejo need POST
    // to create (their PUT requires an existing sha) — see createMethod.
    // On a genuine 409 (another commit landed between our sha lookup and
    // our write) retry once with a freshly read sha, per GitHub's own docs.
    for (let attempt = 0; ; attempt++) {
      let sha;
      if (overwrite) {
        try {
          const existing = await requestAPI({path: contentsPathForRead(file)});
          sha = existing.sha;
          shaCache.set(file, sha);
        } catch (err) {
          if (err.code !== 404) throw err;
        }
      }
      const params = {message: "", content: base64.encode(data), branch};
      if (sha) params.sha = sha;
      const args = {
        method: sha ? "PUT" : createMethod.toUpperCase(),
        path: contentsPath(file),
        contentType: "application/json",
        body: JSON.stringify(params)
      };
      try {
        const result = await requestAPI(args);
        shaCache.set(file, result.content.sha);
        return;
      } catch (err) {
        if (attempt === 0 && err.code === 409) continue;
        if (!overwrite && (err.code === 422 || err.code === 409)) {
          err.code = "EEXIST";
        }
        throw err;
      }
    }
  }

  function post(file, data) {
    return put(file, data, false);
  }

  async function delete_(file) {
    // Same stale-sha race as put() applies here.
    for (let attempt = 0; ; attempt++) {
      let sha;
      try {
        const existing = await requestAPI({path: contentsPathForRead(file)});
        sha = existing.sha;
      } catch (err) {
        if (err.code === 404) return;
        throw err;
      }
      try {
        await requestAPI({
          method: "DELETE",
          path: contentsPath(file),
          contentType: "application/json",
          body: JSON.stringify({message: "", sha, branch})
        });
        shaCache.delete(file);
        return;
      } catch (err) {
        if (attempt === 0 && err.code === 409) continue;
        if (err.code === 404) return;
        throw err;
      }
    }
  }
}

module.exports = createDrive;
