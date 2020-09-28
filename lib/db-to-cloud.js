const {createLock} = require("@eight04/read-write-lock");

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
  
  if (!drive.acquireLock) {
    drive.acquireLock = acquireLock;
    drive.releaseLock = releaseLock;
  }
  
  if (!drive.getMeta) {
    drive.getMeta = getMeta;
    drive.putMeta = putMeta;
  }
  
  if (!drive.peekChanges) {
    drive.peekChanges = peekChanges;
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
  
  async function getMeta() {
    try {
      return await this.get("meta.json");
    } catch (err) {
      if (err.code === "ENOENT" || err.code === 404) {
        return {};
      }
      throw err;
    }
  }
  
  async function putMeta(data) {
    await this.put("meta.json", data);
  }
  
  async function peekChanges(oldMeta) {
    const newMeta = await this.getMeta();
    return newMeta.lastChange !== oldMeta.lastChange;
  }
}

function dbToCloud({
  onGet,
  onPut,
  onDelete,
  onFirstSync,
  onWarn = console.error,
  onProgress,
  compareRevision,
  getState,
  setState,
  lockExpire = 60
}) {
  let drive;
  let state;
  let meta;
  const changeCache = new Map;
  const saveState = debounced(() => setState(drive, state));
  const revisionCache = new Map;
  const lock = createLock();
  return {
    use,
    init,
    uninit,
    put,
    delete: delete_,
    syncNow,
    drive: () => drive,
    isInit: () => Boolean(state && state.enabled)
  };
  
  function use(newDrive) {
    drive = buildDrive(newDrive);
  }
  
  function init() {
    return lock.write(async () => {
      if (state && state.enabled) {
        return;
      }
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
    });
  }
  
  function uninit() {
    return lock.write(async () => {
      if (!state || !state.enabled) {
        return;
      }
      state = meta = null;
      changeCache.clear();
      revisionCache.clear();
      if (drive.uninit) {
        await drive.uninit();
      }
      await saveState();
    });
  }
  
  async function syncPull() {
    meta = await drive.getMeta();
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
        const newChanges = await drive.get(`changes/${i}.json`);
        changeCache.set(i, newChanges);
        changes = changes.concat(newChanges);
        i++;
      }
      changes = changes.slice(state.lastChange % 100);
    }
    // merge changes
    const idx = new Map;
    for (const change of changes) {
      idx.set(change._id, change);
    }
    let loaded = 0;
    for (const [id, change] of idx) {
      let doc, _rev;
      if (onProgress) {
        onProgress({
          phase: 'pull',
          total: idx.size,
          loaded,
          change
        });
      }
      if (change.action === "delete") {
        await onDelete(id, change._rev);
      } else if (change.action === "put") {
        try {
          ({doc, _rev} = await drive.get(`docs/${id}.json`));
        } catch (err) {
          if (err.code === "ENOENT" || err.code === 404) {
            onWarn(`Cannot find ${id}. Is it deleted without updating the history?`);
            loaded++;
            continue;
          }
          throw err;
        }
        await onPut(doc);
      }
      // record the remote revision
      const rev = change._rev || _rev;
      if (rev) {
        revisionCache.set(id, rev);
      }
      loaded++;
    }
    state.lastChange = meta.lastChange;
    await saveState();
  }
  
  async function syncPush() {
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
    // drop outdated change
    const newChanges = [];
    for (const change of idx.values()) {
      // FIXME: is it safe to assume that the local doc is newer when
      // remoteRev is undefined?
      const remoteRev = revisionCache.get(change._id);
      if (remoteRev !== undefined && compareRevision(change._rev, remoteRev) <= 0) {
        continue;
      }
      newChanges.push(change);
    }
    // FIXME: there should be no need to push data when !newChanges.length
    
    // start pushing
    let loaded = 0;
    for (const change of newChanges) {
      if (onProgress) {
        onProgress({
          phase: 'push',
          loaded,
          total: newChanges.length,
          change
        });
      }
      if (change.action === "delete") {
        await drive.delete(`docs/${change._id}.json`);
      } else if (change.action === "put") {
        const doc = await onGet(change._id, change._rev);
        await drive.put(`docs/${change._id}.json`, {doc, _rev: change._rev});
      }
      revisionCache.set(change._id, change._rev);
      loaded++;
    }
    
    // push changes
    let lastChanges;
    let index;
    // meta is already pulled in syncPull
    if (meta.lastChange) {
      index = Math.floor(meta.lastChange / 100);
      const len = meta.lastChange % 100;
      lastChanges = len ?
        changeCache.get(index) || await drive.get(`changes/${index}.json`) :
        [];
      // it is possible that JSON data contains more records defined by
      // meta.lastChange
      lastChanges = lastChanges.slice(0, len).concat(newChanges);
    } else {
      // first sync
      index = 0;
      lastChanges = newChanges;
    }
    
    for (let i = 0; i * 100 < lastChanges.length; i++) {
      const window = lastChanges.slice(i * 100, (i + 1) * 100);
      await drive.put(`changes/${index + i}.json`, window);
      changeCache.set(index + i, window);
    }
    meta.lastChange = (meta.lastChange || 0) + newChanges.length;
    await drive.putMeta(meta);
    
    state.queue = state.queue.slice(changes.length);
    state.lastChange = meta.lastChange;
    await saveState();
  }
  
  async function sync() {
    await drive.acquireLock(lockExpire);
    try {
      await syncPull();
      await syncPush();
    } finally {
      await drive.releaseLock();
    }
  }
  
  function syncNow(peek) {
    return lock.write(async () => {
      if (!state || !state.enabled) {
        throw new Error("Cannot sync now, the sync is not enabled");
      }
      if (state.lastChange == null) {
        await onFirstSync();
      }
      await _syncNow(peek);
    });
  }
  
  async function _syncNow(peek = true) {
    if (onProgress) {
      onProgress({
        phase: 'start'
      });
    }
    try {
      if (!state.queue.length && peek && meta) {
        const changed = await drive.peekChanges(meta);
        if (!changed) {
          return;
        }
      }
      await sync();
    } finally {
      if (onProgress) {
        onProgress({
          phase: 'end'
        });
      }
    }
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
}

module.exports = {dbToCloud};
