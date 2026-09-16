/* global self */
const base64 = require("universal-base64");

const {createRequest} = require("../request");

// Also covers GHES, Gitea, and Forgejo — they implement the same Contents
// API, so `apiBase` is enough to target any of them; no per-host branching.
// Verified directly against a real Gitea instance: PUT with no `sha`
// creates the file there too (its own docs say so), so there's no separate
// "create" method to pick between hosts — PUT always does both, everywhere.
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
  // No default branch is forced — unset means "the repository's actual
  // default branch," which contentsPath()/put()/delete_() take as "omit
  // ?ref= / the branch field entirely," not as a literal "main".
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
      // Plain JSON rather than GitHub's vnd.github.v3+json — Gitea/Forgejo
      // have no reason to honor a GitHub-specific media type.
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

  // A 404 from the contents endpoint is ambiguous: missing repo vs. repo
  // exists but this path is simply empty. Exposed for a caller that wants
  // to tell those apart; list()/get() don't call this themselves — a plain
  // 404 from either is allowed to propagate as-is.
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
    // shaCache is the source of truth: list()/get() are expected to have
    // populated it already. No defensive re-fetch here — a stale or
    // missing sha is a real problem for the caller to see, not something
    // to paper over with an extra round trip.
    let sha;
    if (overwrite) {
      sha = shaCache.get(file);
      if (sha === undefined) {
        const err = new Error(`No cached sha for "${file}" — list() or get() it before overwriting.`);
        err.code = "ENOSHA";
        throw err;
      }
    }
    const params = {message: "", content: base64.encode(data)};
    if (branch) params.branch = branch;
    if (sha) params.sha = sha;
    try {
      const result = await requestAPI({
        method: "PUT",
        path: contentsPath(file),
        contentType: "application/json",
        body: JSON.stringify(params)
      });
      // Only recorded once the write actually succeeded.
      shaCache.set(file, result.content.sha);
    } catch (err) {
      if (!overwrite && (err.code === 422 || err.code === 409)) {
        // GitHub: 422 "sha wasn't supplied" when the file already exists.
        // Gitea's equivalent create-conflict response isn't independently
        // verified, so this stays permissive on either code.
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
        // Debug convenience only — lets you delete a file you haven't
        // list()ed/get()ed yet. Not a race-avoidance mechanism: a stale
        // sha here is allowed to fail the whole sync, same as put().
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
