// Offline unit tests for the github drive, against a fake fetch — no live
// account needed. github.js in this same directory covers the real API and
// needs GITHUB_ACCESS_TOKEN/GITHUB_OWNER (+ optional GITHUB_API_BASE) in .env.
//
// Run with: node --test test/adapter/github.offline.js
const {test} = require("node:test");
const assert = require("node:assert/strict");

const createDrive = require("../../lib/drive/github");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
}

test("throws if owner/repo are missing", () => {
  assert.throws(() => createDrive({}), /owner and repo are required/);
});

test("sends Bearer auth by default, against api.github.com by default", async t => {
  const fetch = t.mock.fn(() => jsonResponse([]));
  const drive = createDrive({owner: "alice", repo: "scripts", getAccessToken: () => "plain-token", fetch});
  await drive.list("");
  const [url, opts] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.github.com/repos/alice/scripts/contents");
  assert.equal(opts.headers["Authorization"], "Bearer plain-token");
});

test("apiBase: \"\" is treated the same as unset, not a literal empty host", async t => {
  const fetch = t.mock.fn(() => jsonResponse([]));
  const drive = createDrive({owner: "alice", repo: "scripts", apiBase: "", fetch});
  await drive.list("");
  const [url] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.github.com/repos/alice/scripts/contents");
});

test("honors a custom apiBase (e.g. a self-hosted Gitea instance)", async t => {
  const fetch = t.mock.fn(() => jsonResponse([]));
  const drive = createDrive({
    owner: "alice",
    repo: "scripts",
    apiBase: "https://code.example.org/api/v1",
    fetch
  });
  await drive.list("");
  const [url] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://code.example.org/api/v1/repos/alice/scripts/contents");
});

test("no branch set: no ?ref= on reads, no branch field on writes", async t => {
  const responses = [
    jsonResponse([]),
    jsonResponse({content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}, 201)
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  const [listUrl] = fetch.mock.calls[0].arguments;
  assert.equal(listUrl, "https://api.github.com/repos/alice/scripts/contents");
  await drive.post("new.user.js", "abc");
  const [putUrl, putOpts] = fetch.mock.calls[1].arguments;
  assert.equal(putUrl, "https://api.github.com/repos/alice/scripts/contents/new.user.js");
  assert.equal(JSON.parse(putOpts.body).branch, undefined);
});

test("branch set: ?ref= on reads, branch field on writes", async t => {
  const responses = [
    jsonResponse([]),
    jsonResponse({content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}, 201)
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", branch: "dev", fetch});
  await drive.list("");
  const [listUrl] = fetch.mock.calls[0].arguments;
  assert.equal(listUrl, "https://api.github.com/repos/alice/scripts/contents?ref=dev");
  await drive.post("new.user.js", "abc");
  const [, putOpts] = fetch.mock.calls[1].arguments;
  assert.equal(JSON.parse(putOpts.body).branch, "dev");
});

// Covers the first-sync case: db-to-cloud's syncPush() calls put() on
// brand-new docs/*.json before list()/get() ever ran, so shaCache starts
// empty — this is what "no cached sha means create" is for.
test("put() should not throw when no cached sha", async t => {
  const fetch = t.mock.fn(() =>
    jsonResponse({content: {name: "untracked.user.js", path: "untracked.user.js", sha: "newsha"}}, 201));
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.put("untracked.user.js", "abc");
  assert.equal(fetch.mock.calls.length, 1);
  const [, opts] = fetch.mock.calls[0].arguments;
  assert.equal(JSON.parse(opts.body).sha, undefined);
  assert.equal(drive.shaCache.get("untracked.user.js"), "newsha");
});

test("put() sends the cached sha to the server", async t => {
  const responses = [
    jsonResponse([{name: "existing.user.js", path: "existing.user.js", sha: "cached-sha"}]),
    jsonResponse({content: {name: "existing.user.js", path: "existing.user.js", sha: "newsha"}})
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  await drive.put("existing.user.js", "abc");
  assert.equal(fetch.mock.calls.length, 2); // the list(), then the PUT — no extra sha-refresh GET
  const [, putOpts] = fetch.mock.calls[1].arguments;
  assert.equal(JSON.parse(putOpts.body).sha, "cached-sha");
});

test("put() only records the sha in its cache after a successful write", async t => {
  const responses = [
    jsonResponse([{name: "existing.user.js", path: "existing.user.js", sha: "cached-sha"}]),
    jsonResponse({message: "boom"}, 500)
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  await assert.rejects(() => drive.put("existing.user.js", "abc"));
  // shaCache still holds the pre-write value, not something from the failed response
  assert.equal(drive.shaCache.get("existing.user.js"), "cached-sha");
});

test("post() (create-only) needs no cached sha and creates via PUT with none", async t => {
  const fetch = t.mock.fn(() =>
    jsonResponse({content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}, 201));
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.post("new.user.js", "abc");
  const [, opts] = fetch.mock.calls[0].arguments;
  assert.equal(opts.method, "PUT");
  assert.equal(JSON.parse(opts.body).sha, undefined);
});

test("post() (create-only) reports code: EEXIST when the file already exists", async t => {
  // 422 "sha wasn't supplied" is GitHub's response; 409 is treated the same.
  const fetch = t.mock.fn(() => jsonResponse({message: "\"sha\" wasn't supplied"}, 422));
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await assert.rejects(() => drive.post("taken.user.js", "abc"), err => {
    assert.equal(err.code, "EEXIST");
    return true;
  });
});

test("delete() uses the cached sha and clears it on success", async t => {
  const responses = [
    jsonResponse([{name: "gone.user.js", path: "gone.user.js", sha: "cached-sha"}]),
    jsonResponse({commit: {}})
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  assert.equal(drive.shaCache.get("gone.user.js"), "cached-sha");
  await drive.delete("gone.user.js");
  const [, delOpts] = fetch.mock.calls[1].arguments;
  assert.equal(delOpts.method, "DELETE");
  assert.equal(JSON.parse(delOpts.body).sha, "cached-sha");
  assert.equal(drive.shaCache.has("gone.user.js"), false);
});

// File modified by another client during the sync, making the cached sha
// stale — distinct from put()'s "a sha is never expected to go stale".
test("delete() surfaces a 409 (stale sha) instead of retrying", async t => {
  const responses = [
    jsonResponse([{name: "stuck.user.js", path: "stuck.user.js", sha: "cached-sha"}]),
    jsonResponse({message: "sha mismatch"}, 409)
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  await assert.rejects(() => drive.delete("stuck.user.js"));
  assert.equal(fetch.mock.calls.length, 2); // no retry
});

test("delete() on an already-gone file (404) is a no-op", async t => {
  const responses = [
    jsonResponse([{name: "already-gone.user.js", path: "already-gone.user.js", sha: "cached-sha"}]),
    jsonResponse({message: "Not Found"}, 404)
  ];
  const fetch = t.mock.fn(() => responses.shift());
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await drive.list("");
  await drive.delete("already-gone.user.js"); // should not throw
});

test("list()/get() let a 404 propagate as-is, without guessing repo-vs-empty-path", async t => {
  const fetch = t.mock.fn(() => jsonResponse({message: "Not Found"}, 404));
  const drive = createDrive({owner: "alice", repo: "scripts", fetch});
  await assert.rejects(() => drive.list(""), err => {
    assert.equal(err.code, 404);
    return true;
  });
});

test("checkRepoExists() is available for a caller that wants to disambiguate that 404 itself", async t => {
  const fetch = t.mock.fn(() => jsonResponse({message: "Not Found"}, 404));
  const drive = createDrive({owner: "alice", repo: "missing", fetch});
  assert.equal(await drive.checkRepoExists(), false);
  const [url, opts] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.github.com/repos/alice/missing");
  assert.equal(opts.method, undefined); // plain GET
});

test("checkRepoExists() never adds ?ref= — it doesn't go through contentsPath()", async t => {
  const fetch = t.mock.fn(() => jsonResponse({}));
  const drive = createDrive({owner: "alice", repo: "scripts", branch: "dev", fetch});
  await drive.checkRepoExists();
  const [url] = fetch.mock.calls[0].arguments;
  assert.equal(url, "https://api.github.com/repos/alice/scripts");
});
