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

function buildDrive(drive) {
  return {
    init: drive.init && drive.init.bind(drive),
    uninit: drive.uninit && drive.uninit.bind(drive),
    get: async path => JSON.parse(await drive.get(path)),
    put: async (path, data) => await drive.put(path, JSON.stringify(data)),
    post: async (path, data) => await drive.post(path, JSON.stringify(data)),
    delete: drive.delete.bind(drive),
    acquireLock: drive.acquireLock ? drive.acquireLock.bind(drive) : acquireLock,
    releaseLock: drive.acquireLock ? drive.releaseLock.bind(drive) : releaseLock
  };
  
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
  const saveState = debounced(() => setState(drive, state));
  const revisionCache = new Map;
  return {use, start, stop, put, delete: delete_};
  
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
    if (state.lastChange == null) {
      await onFirstSync();
    }
    currentTask = sync();
    await currentTask;
  }
  
  async function stop() {
    state.enabled = false;
    clearTimeout(timer);
    await currentTask;
    if (drive.uninit) {
      await drive.uninit();
    }
    await saveState();
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
    let lastChanges = await cache.get("changes/${index}.json", []);
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
    const cache = buildCache();
    try {
      await syncPull(cache);
      await syncPush(cache);
    } catch (err) {
      await onError(err);
      throw err;
    } finally {
      await drive.releaseLock();
      timer = setTimeout(() => {
        currentTask = sync();
      }, period);
    }
  }
  
  function put(_id, _rev) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push({
      _id, _rev, action: "put"
    });
  }
  
  function delete_(_id, _rev) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push({
      _id, _rev, action: "delete"
    });
  }
  
  function buildCache() {
    const store = new Map;
    return {get, has};
    
    async function get(path, default_) {
      let result;
      result = store.get(path);
      if (result !== undefined) {
        return result;
      }
      try {
        result = await drive.get(path);
      } catch (err) {
        if (err.code === 404 && default_ !== undefined) {
          return default_;
        }
        throw err;
      }
      store.set(path, result);
      return result;
    }
    
    function has(path) {
      return store.has(path);
    }
  }
}

module.exports = {dbToCloud};
