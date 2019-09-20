const base64 = require("universal-base64");

const {CustomError} = require("./error");

function createDrive({
  owner,
  repo,
  getAccessToken
}) {
  let octokit;
  const shaCache = new Map;
  const api = {
    name: "github",
    init,
    get,
    put,
    post,
    delete: delete_,
    list,
    api: () => octokit,
    shaCache
  };
  for (const [key, fn] of Object.entries(api)) {
    if (typeof fn !== "function") {
      continue;
    }
    api[key] = async (...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        if (err.status === 404) {
          throw new CustomError("ENOENT", err);
        }
        throw err;
      }
    };
  }
  return api;
  
  async function init() {
    const {Octokit} = await Promise.resolve(require("./github-core"));
    octokit = new Octokit({
      async auth() {
        return `token ${await getAccessToken()}`;
      },
      throttle: {
        onAbuseLimit: (retryAfter, options) => {
          console.warn(`Abuse detected for request ${options.method} ${options.url}`);
          return false;
        },
        onRateLimit: (retryAfter, options) => {
          console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
          return false;
        }
      }
    });
  }
  
  async function list(file) {
    // FIXME: it seems that it will fail when containing more than 1000 items
    const result = await octokit.repos.getContents({
      owner, repo, path: file
    });
    const names = [];
    for (const item of result.data) {
      names.push(item.name);
      shaCache.set(item.path, item.sha);
    }
    return names;
  }
  
  async function get(file) {
    const result = await octokit.repos.getContents({
      owner, repo, path: file
    });
    shaCache.set(result.data.path, result.data.sha);
    return base64.decode(result.data.content);
  }
  
  async function put(file, data) {
    const options = {
      owner, repo, path: file, message: "", content: base64.encode(data)
    };
    if (shaCache.has(file)) {
      options.sha = shaCache.get(file);
    }
    let result;
    try {
      result = await octokit.repos.createOrUpdateFile(options);
    } catch (err) {
      if (err.status === 422 && !options.sha) {
        await get(file);
        return await put(file, data);
      }
      throw err;
    }
    shaCache.set(file, result.data.content.sha);
  }
  
  async function post(file, data) {
    let result;
    try {
      result = await octokit.repos.createOrUpdateFile({
        owner, repo, path: file, message: "", content: base64.encode(data)
      });
    } catch (err) {
      if (err.status === 422) {
        throw new CustomError("EEXIST", err);
      }
      throw err;
    }
    shaCache.set(file, result.data.content.sha);
  }
  
  async function delete_(file) {
    const sha = shaCache.has(file);
    if (!sha) {
      await get(file);
    }
    try {
      await octokit.repos.deleteFile({
        owner, repo, path: file, message: "", sha: shaCache.get(file)
      });
    } catch (err) {
      if (err.status === 404) {
        return;
      }
      // FIXME: do we have to handle 422 errors?
      throw err;
    }
  }
}

module.exports = createDrive;
