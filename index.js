const {createLock} = require("@eight04/read-write-lock");
const drive = require("./drive");

function debounced(fn) {
  let timer = 0;
  let q;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(run);
    if (!q) {
      q = defer();
    }
    return q.promise;
  };
  
  function run() {
    Promise.resolve(fn())
      .then(q.resolve, q.reject);
    timer = 0;
    q = null;
  }
  
  function defer() {
    const o = {};
    o.promise = new Promise((resolve, reject) => {
      o.resolve = resolve;
      o.reject = reject;
    });
    return o;
  }
}

function buildDrive(_drive) {
  const drive = Object.create(_drive);
  drive.get = async path => JSON.parse(await _drive.get(path));
  drive.put = async (path, data) => await _drive.put(path, JSON.stringify(data));
  drive.post = async (path, data) => await _drive.post(path, JSON.stringify(data));
  
  if (!_drive.acquireLock) {
    drive.acquireLock = acquireLock;
    drive.releaseLock = releaseLock;
  }
  
  return drive;
  
  async function acquireLock(expire) {
    try {
      await this.post("lock.json", {expire: Date.now() + expire * 60 * 1000});
    } catch (err) {
      if (err.code === "EEXIST") {
        const data = await this.get("lock.json");
        if (Date.now() > data.expire) {
          await this.delete("lock.json");
        }
      }
      throw err;
    }
  }
  
  async function releaseLock() {
    await this.delete("lock.json");
  }
}

function dbToCloud({
  onGet,
  onPut,
  onDelete,
  onError,
  onFirstSync,
  compareRevision,
  getState,
  setState,
  period = 5,
  lockExpire = 60
}) {
  let drive;
  let timer;
  let state;
  let currentTask;
  let pendingTask;
  const saveState = debounced(() => setState(drive, state));
  const revisionCache = new Map;
  const lock = createLock();
  return {use, start, stop, put, delete: delete_, syncNow};
  
  function use(newDrive) {
    drive = buildDrive(newDrive);
  }
  
  async function start() {
    if (!drive) {
      throw new Error("cloud drive is undefined");
    }
    if (drive.init) {
      await drive.init();
    }
    
    state = await getState(drive) || {};
    state.enabled = true;
    if (!state.queue) {
      state.queue = [];
    }
    if (state.lastChange == null) {
      await onFirstSync();
    }
    await syncNow();
  }
  
  async function stop() {
    state.enabled = false;
    await lock.write(async () => {
      clearTimeout(timer);
      if (drive.uninit) {
        await drive.uninit();
      }
      await saveState();
    });
  }
  
  async function syncPull(cache) {
    const meta = await cache.get("changes/meta.json", {});
    if (!meta.lastChange || meta.lastChange === state.lastChange) {
      // nothing changes
      return;
    }
    let changes = [];
    if (!state.lastChange) {
      // pull everything
      changes = (await drive.list("docs"))
        .map(name => ({action: 'put', _id: name.slice(0, -5)}));
    } else {
      const end = Math.floor((meta.lastChange - 1) / 100); // inclusive end
      let i = Math.floor(state.lastChange / 100);
      while (i <= end) {
        changes = changes.concat(await cache.get(`changes/${i}.json`));
        i++;
      }
      changes = changes.slice(state.lastChange % 100);
    }
    // merge changes
    const idx = new Map;
    for (const change of changes) {
      idx.set(change._id, change);
    }
    for (const [id, change] of idx) {
      if (change.action === "delete") {
        await onDelete(id, change._rev);
      } else if (change.action === "put") {
        let doc;
        try {
          doc = await cache.get(`docs/${id}.json`);
        } catch (err) {
          if (err.code === "ENOENT") {
            await onError(new Error(`Cannot find ${id}. Is it deleted without updating the history?`));
            continue;
          }
          throw err;
        }
        await onPut(doc);
      }
      // record the remote revision
      revisionCache.set(id, change._rev);
    }
    state.lastChange = meta.lastChange;
    await saveState();
  }
  
  async function syncPush(cache) {
    if (!state.queue.length) {
      // nothing to push
      return;
    }
    
    // snapshot
    const changes = state.queue.slice();
    
    // merge changes
    const idx = new Map;
    for (const change of changes) {
      idx.set(change._id, change);
    }
    const newChanges = [];
    for (const [id, change] of idx.entries()) {
      // FIXME: is it safe to assume that the local doc is newer when
      // remoteRev is undefined?
      const remoteRev = revisionCache.get(change._id);
      if (remoteRev !== undefined && compareRevision(change._rev, remoteRev) <= 0) {
        continue;
      }
      if (change.action === "delete") {
        await drive.delete(`docs/${id}.json`);
      } else if (change.action === "put") {
        await drive.put(`docs/${id}.json`, await onGet(id, change._rev));
      }
      revisionCache.set(id, change._rev);
      newChanges.push(change);
    }
    
    // update changes/meta
    const meta = await cache.get("changes/meta.json", {lastChange: 0});
    const index = Math.floor(meta.lastChange / 100);
    const len = meta.lastChange % 100;
    let lastChanges = await cache.get(`changes/${index}.json`, []);
    // it is possible that JSON data contains more records defined by
    // meta.lastChange
    lastChanges = lastChanges.slice(0, len).concat(newChanges);
    
    for (let i = 0; i * 100 < lastChanges.length; i++) {
      await drive.put(`changes/${index + i}.json`, lastChanges.slice(i * 100, (i + 1) * 100));
    }
    meta.lastChange += newChanges.length;
    await drive.put("changes/meta.json", meta);
    
    state.queue = state.queue.slice(changes.length);
    state.lastChange = meta.lastChange;
    await saveState();
  }
  
  async function sync() {
    await drive.acquireLock(lockExpire);
    const meta = drive.getMeta();
    if (meta.lastChange === state.lastChange && !state.queue.length) {
      return;
    }
    const cache = buildCache();
    try {
      await syncPull(cache);
      await syncPush(cache);
    } catch (err) {
      await onError(err);
      throw err;
    } finally {
      await drive.releaseLock();
    }
  }
  
  async function syncNow() {
    if (!state.enabled) {
      throw new Error("Cannot sync now, the sync is not enabled");
    }
    await lock.write(async () => {
      try {
        await sync();
      } finally {
        schedule();
      }
    });
  }
  
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (lock.length) {
        return;
      }
      syncNow();
    }, period * 60 * 1000);
  }
  
  function put(_id, _rev) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push({
      _id, _rev, action: "put"
    });
    saveState();
  }
  
  function delete_(_id, _rev) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push({
      _id, _rev, action: "delete"
    });
    saveState();
  }
  
  function buildCache() {
    const store = new Map;
    return {get};
    
    async function get(path, default_) {
      let result;
      result = store.get(path);
      if (result !== undefined) {
        return result;
      }
      try {
        result = await drive.get(path);
      } catch (err) {
        if (err.code === "ENOENT" && default_ !== undefined) {
          return default_;
        }
        throw err;
      }
      store.set(path, result);
      return result;
    }
  }
}

module.exports = {dbToCloud, drive};
