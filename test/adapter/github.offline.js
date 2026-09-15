// Offline unit tests for the github drive, against a fake fetch — no live
// account needed. The github.js integration test in this same directory
// covers the real API (github.com by default, or a self-hosted instance via
// GITHUB_API_BASE) and needs GITHUB_ACCESS_TOKEN/GITHUB_OWNER in .env.
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
    calls.push({url: path, method, body, headers: init.headers || {}, cache: init.cache});
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

test("sends token as `Authorization: token <t>`, cache: no-store, against api.github.com by default", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "test-token", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents?ref=main");
  assert.equal(calls[0].headers["Authorization"], "token test-token");
  assert.equal(calls[0].cache, "no-store");
});

test("treats apiBase: \"\" the same as unset, not as a literal empty host", async () => {
  // A blank `GITHUB_API_BASE=` line in .env comes through as "", not
  // undefined — a destructuring default only fires on undefined, so this
  // must be handled explicitly or every request loses its host entirely.
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", apiBase: "", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents?ref=main");
});

test("treats branch: \"\" the same as unset (defaults to main), not an empty ?ref=", async () => {
  // Same trap as apiBase — a settings-UI text field left blank sends "",
  // which must not become `?ref=` with nothing after it.
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", branch: "", fetch: fetchImpl});
  await drive.list("");
  assert.equal(calls[0].url, "https://api.github.com/repos/alice/scripts/contents?ref=main");
});

test("treats createMethod: \"\" the same as unset (defaults to put)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/new.user.js": {status: 404, body: {message: "Not Found"}},
    "PUT /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", createMethod: "", fetch: fetchImpl});
  await drive.put("new.user.js", "abc");
  assert.ok(calls.some(c => c.method === "PUT"));
});

test("honors a custom apiBase (e.g. a self-hosted Gitea instance)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /api/v1/repos/alice/scripts/contents": {status: 200, body: []}
  });
  const drive = createDrive({
    owner: "alice",
    repo: "scripts",
    token: "t",
    apiBase: "https://code.example.org/api/v1",
    fetch: fetchImpl
  });
  await drive.list("");
  assert.equal(calls[0].url, "https://code.example.org/api/v1/repos/alice/scripts/contents?ref=main");
});

test("treats a 404 on an empty-but-existing repo as an empty listing, not an error", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 404, body: {message: "Not Found"}},
    "GET /repos/alice/scripts": {status: 200, body: {full_name: "alice/scripts"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  assert.deepEqual(await drive.list(""), []);
  assert.ok(calls.some(c => c.url.endsWith("/repos/alice/scripts")));
});

test("throws a code: ENOREPO error when the repo itself does not exist", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents": {status: 404, body: {message: "Not Found"}},
    "GET /repos/alice/scripts": {status: 404, body: {message: "Not Found"}}
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await assert.rejects(() => drive.list(""), err => {
    assert.equal(err.code, "ENOREPO");
    return true;
  });
});

test("put() creates via PUT without a sha when none exists yet (GitHub default)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/new.user.js": {status: 404, body: {message: "Not Found"}},
    "PUT /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await drive.put("new.user.js", "abc");
  const putCall = calls.find(c => c.method === "PUT");
  assert.equal(putCall.body.sha, undefined);
});

test("put() creates via POST when createMethod is 'post' (Gitea/Forgejo)", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/new.user.js": {status: 404, body: {message: "Not Found"}},
    "POST /repos/alice/scripts/contents/new.user.js": {
      status: 201,
      body: {content: {name: "new.user.js", path: "new.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", createMethod: "post", fetch: fetchImpl});
  await drive.put("new.user.js", "abc");
  assert.ok(calls.some(c => c.method === "POST"));
  assert.ok(!calls.some(c => c.method === "PUT"));
});

test("put() always uses PUT (with sha) to update an existing file, regardless of createMethod", async () => {
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/existing.user.js": {
      status: 200,
      body: {name: "existing.user.js", path: "existing.user.js", sha: "oldsha"}
    },
    "PUT /repos/alice/scripts/contents/existing.user.js": {
      status: 200,
      body: {content: {name: "existing.user.js", path: "existing.user.js", sha: "newsha"}}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", createMethod: "post", fetch: fetchImpl});
  await drive.put("existing.user.js", "abc");
  const putCall = calls.find(c => c.method === "PUT");
  assert.equal(putCall.body.sha, "oldsha");
});

test("put() retries once on a stale-sha 409 conflict, re-reading a fresh sha and succeeding", async () => {
  let getCount = 0;
  let putCount = 0;
  const {fetchImpl, calls} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/race.user.js": () => {
      getCount += 1;
      return {
        status: 200,
        body: {name: "race.user.js", path: "race.user.js", sha: getCount === 1 ? "stale-sha" : "fresh-sha"}
      };
    },
    "PUT /repos/alice/scripts/contents/race.user.js": () => {
      putCount += 1;
      return putCount === 1
        ? {status: 409, body: {message: "race.user.js does not match fresh-sha"}}
        : {status: 200, body: {content: {name: "race.user.js", path: "race.user.js", sha: "newest-sha"}}};
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await drive.put("race.user.js", "abc");
  assert.equal(getCount, 2);
  assert.equal(putCount, 2);
  const putCalls = calls.filter(c => c.method === "PUT");
  assert.equal(putCalls[0].body.sha, "stale-sha");
  assert.equal(putCalls[1].body.sha, "fresh-sha");
});

test("put() surfaces a 409 that persists past the retry, rather than looping or swallowing it", async () => {
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/stuck.user.js": {
      status: 200,
      body: {name: "stuck.user.js", path: "stuck.user.js", sha: "some-sha"}
    },
    "PUT /repos/alice/scripts/contents/stuck.user.js": {
      status: 409,
      body: {message: "stuck.user.js does not match some-sha"}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await assert.rejects(() => drive.put("stuck.user.js", "abc"));
});

test("remove() retries once on a stale-sha 409 conflict", async () => {
  let getCount = 0;
  let delCount = 0;
  const {fetchImpl} = makeFakeFetch({
    "GET /repos/alice/scripts/contents/gone-race.user.js": () => {
      getCount += 1;
      return {
        status: 200,
        body: {name: "gone-race.user.js", path: "gone-race.user.js", sha: getCount === 1 ? "stale-sha" : "fresh-sha"}
      };
    },
    "DELETE /repos/alice/scripts/contents/gone-race.user.js": () => {
      delCount += 1;
      return delCount === 1
        ? {status: 409, body: {message: "gone-race.user.js does not match fresh-sha"}}
        : {status: 200, body: {commit: {}}};
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await drive.delete("gone-race.user.js");
  assert.equal(getCount, 2);
  assert.equal(delCount, 2);
});

test("post() (create-only) reports code: EEXIST when the file already exists", async () => {
  // post() never looks up a sha (overwrite: false), so it PUTs with none —
  // GitHub rejects that with 422 "sha wasn't supplied" when the file is
  // already there.
  const {fetchImpl} = makeFakeFetch({
    "PUT /repos/alice/scripts/contents/taken.user.js": {
      status: 422,
      body: {message: "\"sha\" wasn't supplied"}
    }
  });
  const drive = createDrive({owner: "alice", repo: "scripts", token: "t", fetch: fetchImpl});
  await assert.rejects(() => drive.post("taken.user.js", "abc"), err => {
    assert.equal(err.code, "EEXIST");
    return true;
  });
});
