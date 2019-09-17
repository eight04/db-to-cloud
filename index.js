function debounce(fn) {
  let timer = 0;
  let q;
  return () => {
    if (!timer) {
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
  const saveState = debounce(() => setState(state));
  return {use, start, stop, put, delete: delete_};
  
  function use(newDrive) {
    drive = newDrive;
  }
  
  async function start() {
    if (!drive) {
      throw new Error("cloud drive is undefined");
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
      changes = (await cache.get("list.json")).map(id => ['put', id]);
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
    for (const [id, action] of changes) {
      idx.set(id, action);
    }
    for (const [id, action] of idx) {
      if (action === "delete") {
        await onDelete(id);
      } else if (action === "put") {
        const doc = await cache.get(`docs/${id}.json`);
        await onPut(doc);
      }
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
    for (const [id, action] of changes) {
      idx.set(id, action);
    }
    const toPut = [];
    const toDelete = [];
    for (const [id, action] of idx.entries()) {
      if (action === "delete") {
        toDelete.push(id);
      } else if (action === "put") {
        toPut.push(id);
      }
    }
    
    // put
    for (const id of toPut) {
      const doc = await onGet(id);
      const meta = cache.has(`docs/${id}.json`) && await cache.get(`docs/${id}.json`);
      if (meta && compareRevision(doc, meta) <= 0) {
        continue;
      }
      await drive.put(`docs/${id}.json`, doc);
    }
    
    // update changes
    const newChanges = [];
    for (const id of toPut) {
      newChanges.push(['put', id]);
    }
    for (const id of toDelete) {
      newChanges.push(['delete', id]);
    }
    
    const meta = await cache.get("changes/meta.json", {lastChange: 0});
    
    // NOTE: always runs syncPush after syncPull
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
    
    // delete
    for (const id of toDelete) {
      await drive.delete(`docs/${id}.json`);
    }
    
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
  
  function put(id) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push([id, "put"]);
  }
  
  function delete_(id) {
    if (!state || !state.enabled) {
      return;
    }
    state.queue.push([id, "delete"]);
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
