/* global self */
const {createRequest, RequestError} = require("../request");
const {LockError} = require("../lock");

function createDrive({
  getAccessToken,
  fetch = (typeof self !== "undefined" ? self : global).fetch,
  FormData = (typeof self !== "undefined" ? self : global).FormData,
  Blob = (typeof self !== "undefined" ? self : global).Blob
}) {
  const request = createRequest({fetch, getAccessToken});
  const fileMetaCache = new Map;
  let lockRev;
  return {
    name: "google",
    get,
    put,
    post,
    delete: delete_,
    list,
    init,
    acquireLock,
    releaseLock,
    fileMetaCache
  };
  
  async function revDelete(fileId, revId) {
    await request({
      method: "DELETE",
      path: `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revId}`
    });
  }
  
  async function acquireLock(expire) {
    const lock = fileMetaCache.get("lock.json");
    // write the lock to the cloud
    const {headRevisionId} = await queryPatch(lock.id, JSON.stringify({expire: Date.now() + expire * 60 * 1000}), {keepRevisionForever: true});
    try {
      const result = await request({
        path: `https://www.googleapis.com/drive/v3/files/${lock.id}/revisions?fields=revisions(id)`
      });
      for (let i = 1; i < result.revisions.length; i++) {
        const revId = result.revisions[i].id;
        if (revId === headRevisionId) {
          // success
          lockRev = headRevisionId;
          return;
        }
        const rev = JSON.parse(await request({
          path: `https://www.googleapis.com/drive/v3/files/${lock.id}/revisions/${revId}?alt=media`
        }));
        if (rev.expire > Date.now()) {
          // previous lock is still valid
          throw new LockError(rev.expire);
        }
        // delete outdated lock
        await revDelete(lock.id, revId);
      }
      throw new Error("cannot find lock revision");
    } catch (err) {
      // cleanup
      await revDelete(lock.id, headRevisionId);
      throw err;
    }
  }
  
  async function releaseLock() {
    const lock = fileMetaCache.get("lock.json");
    await revDelete(lock.id, lockRev);
    lockRev = null;
  }
  
  async function queryList(path, onPage) {
    path = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name,headRevisionId)" + (path ? "&" + path : "");
    let result = await request({path});
    onPage(result);
    while (result.nextPageToken) {
      result = await request({path: `${path}&pageToken=${result.nextPageToken}`});
      onPage(result);
    }
  }
  
  async function queryPatch(id, text, query) {
    let path = `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=headRevisionId`;
    if (query) {
      path += `&${new URLSearchParams(query).toString()}`;
    }
    return await request({
      method: "PATCH",
      path,
      headers: {
        "Content-Type": "text/plain"
      },
      body: text
    });
  }
  
  async function updateMeta(query) {
    if (query) {
      query = `q=${encodeURIComponent(query)}`;
    }
    await queryList(query, result => {
      for (const file of result.files) {
        fileMetaCache.set(file.name, file);
      }
    });
  }
  
  async function init() {
    await updateMeta();
    if (!fileMetaCache.has("lock.json")) {
      await post("lock.json", "{}");
    }
    if (!fileMetaCache.has("meta.json")) {
      await post("meta.json", "{}");
    }
  }
  
  async function list(file) {
    // FIXME: this only works if file is a single dir
    // FIXME: this only works if the list method is called right after init, use
    // queryList instead?
    return [...fileMetaCache.values()]
      .filter(f => f.name.startsWith(file + "/"))
      .map(f => f.name.split("/")[1]);
  }
  
  async function get(file) {
    let meta = fileMetaCache.get(file);
    if (!meta) {
      await updateMeta(`name = '${file}'`);
      meta = fileMetaCache.get(file);
      if (!meta) {
        throw new RequestError(`metaCache doesn't contain ${file}`, null, "ENOENT");
      }
    }
    try {
      return await request({
        path: `https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media`
      });
    } catch (err) {
      if (err.code === 404) {
        err.code = "ENOENT";
      }
      throw err;
    }
  }
  
  async function put(file, data) {
    if (!fileMetaCache.has(file)) {
      return await post(file, data);
    }
    const meta = fileMetaCache.get(file);
    const result = await queryPatch(meta.id, data);
    meta.headRevisionId = result.headRevisionId;
  }
  
  async function post(file, data) {
    const body = new FormData;
    const meta = {
      name: file,
      parents: ["appDataFolder"]
    };
    body.append("metadata", new Blob([JSON.stringify(meta)], {type: "application/json; charset=UTF-8"}));
    body.append("media", new Blob([data], {type: "text/plain"}));
    const result = await request({
      method: "POST",
      path: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,headRevisionId",
      body
    });
    fileMetaCache.set(result.name, result);
  }
  
  async function delete_(file) {
    const meta = fileMetaCache.get(file);
    if (!meta) {
      return;
    }
    try {
      await request({
        method: "DELETE",
        path: `https://www.googleapis.com/drive/v3/files/${meta.id}`
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
