// Offline unit tests for the github drive, against a fake fetch — no live
// account needed. github.js in this same directory covers the real API and
// needs GITHUB_ACCESS_TOKEN/GITHUB_OWNER (+ optional GITHUB_API_BASE) in .env.
//
// Run with: node --test test/adapter/github.offline.js
const {test} = require("node:test");
const assert = require("node:assert/strict");

const createDrive = require("../../lib/drive/github");

function makeFakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (path, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const url = new URL(path);
    const key = `${method} ${url.pathname}${url.search}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({url: path, method, body, headers: init.headers || {}});
    const entry = routes[key] !== undefined ? routes[key] : routes[`${method} ${url.pathname}`];
    if (!entry) {
      throw new Error(`Unhandled fake request: ${key}\nKnown: ${Object.keys(routes).join(", ")}`);
    }
    const {status, body: resBody} = typeof entry === "function" ? entry() : entry;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {get: name => (name.toLowerCase() === "content-type" ? "application/json" : null)},
      json: async () => resBody,
      text: async () => JSON.stringify(resBody)
    };
  };
  return {fetchImpl, calls};
}

test("throws if owner/repo are missing", () => {
  assert.throws(() => createDrive({}), /owner and repo are required/);
});

test("sends Bearer auth by default, against api.github.com by default", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", getAccessToken: () => "plain-token", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents");
  assert.equal(calls[0].headers["Authorization"], "Bearer plain-token");
});

test("getAccessToken returning {scheme, param} sends that scheme instead of Bearer", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({
    owner: "alice",
    repo: "scripts",
    getAccessToken: () => ({scheme: "token", param: "pat-value"}),
    fetch: fetchImpl
  });
  await drive.list("");
  assert.equal(calls[0].headers["Authorization"], "token pat-value");
});

test("apiBase: \"\" is treated the same as unset, not a literal empty host", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", apiBase: "", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents");
});

test("honors a custom apiBase (e.g. a self-hosted Gitea instance)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /api/v1/repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({
    owner: "alice",
    repo: "scripts",
    apiBase: "https://code.example.org/api/v1",
    fetch: fetchImpl
  });
  await drive.list("");
  assert.equal(calls[0].url, "https://code.example.org/api/v1/repos/alice/scripts/contents");
});

test("no branch set: no ?ref= on reads, no branch field on writes", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []},
    "PUT /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents");
  await drive.post("new.user.js", "abc");
  const putCall = calls.find(c => c.method === "PUT");
  assert.equal(putCall.url, "https://api.github.com/repos/alice/scripts/contents/new.user.js");
  assert.equal(putCall.body.branch, undefined);
});

test("branch set: ?ref= on reads, branch field on writes", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents?ref=dev": {status: 200, body: []},
    "PUT /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", branch: "dev", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents?ref=dev");
  await drive.post("new.user.js", "abc");
  const putCall = calls.find(c => c.method === "PUT");
  assert.equal(putCall.body.branch, "dev");
});

test("put() with overwrite=true and no cached sha does a plain create (no sha in body)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "PUT /repos/alice/scripts/contents/untracked.user.js": {
      status: 201,
      body: {content: {name: "untracked.user.js", path: "untracked.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.put("untracked.user.js", "abc");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.sha, undefined);
  assert.equal(drive.shaCache.get("untracked.user.js"), "newsha");
});

test("put() with overwrite=true uses the cached sha (from a prior list()) with no extra request", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: [
      {name: "existing.user.js", path: "existing.user.js", sha: "cached-sha"}
    ]},
    "PUT /repos/alice/scripts/contents/existing.user.js": {
      status: 200,
      body: {content: {name: "existing.user.js", path: "existing.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.list("");
  await drive.put("existing.user.js", "abc");
  assert.equal(calls.length, 2); // the list(), then the PUT — no extra sha-refresh GET
  const putCall = calls.find(c => c.method === "PUT");
  assert.equal(putCall.body.sha, "cached-sha");
});

test("put() only records the sha in its cache after a successful write", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: [
      {name: "existing.user.js", path: "existing.user.js", sha: "cached-sha"}
    ]},
    "PUT /repos/alice/scripts/contents/existing.user.js": {status: 500, body: {message: "boom"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.list("");
  await assert.rejects(() => drive.put("existing.user.js", "abc"));
  // shaCache still holds the pre-write value, not something from the failed response
  assert.equal(drive.shaCache.get("existing.user.js"), "cached-sha");
});

test("post() (create-only) needs no cached sha and creates via PUT with none", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "PUT /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.post("new.user.js", "abc");
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].body.sha, undefined);
});

test("post() (create-only) reports code: EEXIST when the file already exists", async () => {
  // 422 "sha wasn't supplied" is GitHub's response; 409 is treated the same.
  const {fetchImpl} = makeFakeFetch({
    "PUT /repos/alice/scripts/contents/taken.user.js": {
      status: 422,
      body: {message: "\"sha\" wasn't supplied"}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await assert.rejects(() => drive.post("taken.user.js", "abc"), err => {
    assert.equal(err.code, "EEXIST");
    return true;
  });
});

test("delete() uses the cached sha and clears it on success", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: [
      {name: "gone.user.js", path: "gone.user.js", sha: "cached-sha"}
    ]},
    "DELETE /repos/alice/scripts/contents/gone.user.js": {status: 200, body: {commit: {}}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.list("");
  await drive.delete("gone.user.js");
  const delCall = calls.find(c => c.method === "DELETE");
  assert.equal(delCall.body.sha, "cached-sha");
  assert.equal(drive.shaCache.has("gone.user.js"), false);
});

test("delete() with no cached sha fetches it once first (debug convenience), not as a retry loop", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/untracked.user.js": {
      status: 200,
      body: {name: "untracked.user.js", path: "untracked.user.js", sha: "fetched-sha", content: "eA=="}
    },
    "DELETE /repos/alice/scripts/contents/untracked.user.js": {status: 200, body: {commit: {}}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.delete("untracked.user.js");
  assert.equal(calls.length, 2); // the one-time get(), then the DELETE
  const delCall = calls.find(c => c.method === "DELETE");
  assert.equal(delCall.body.sha, "fetched-sha");
});

test("delete() surfaces a 409 (stale sha) instead of retrying", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: [
      {name: "stuck.user.js", path: "stuck.user.js", sha: "cached-sha"}
    ]},
    "DELETE /repos/alice/scripts/contents/stuck.user.js": {status: 409, body: {message: "sha mismatch"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.list("");
  await assert.rejects(() => drive.delete("stuck.user.js"));
  assert.equal(calls.filter(c => c.method === "DELETE").length, 1); // no retry
});

test("delete() on an already-gone file (404) is a no-op", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/already-gone.user.js": {status: 404, body: {message: "Not Found"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await drive.delete("already-gone.user.js"); // should not throw
});

test("list()/get() let a 404 propagate as-is, without guessing repo-vs-empty-path", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 404, body: {message: "Not Found"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", fetch: fetchImpl});
  await assert.rejects(() => drive.list(""), err => {
    assert.equal(err.code, 404);
    return true;
  });
});

test("checkRepoExists() is available for a caller that wants to disambiguate that 404 itself", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/missing": {status: 404, body: {message: "Not Found"}}
  });
  const drive = createDrive({owner: "alice", repo: "missing", fetch: fetchImpl});
  assert.equal(await drive.checkRepoExists(), false);
});
