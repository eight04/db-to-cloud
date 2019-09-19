db-to-cloud
===========

Synchronize your database with a cloud drive i.e. Dropbox, Google Drive, OneDrive, Github, etc.

To use this library, add following properties to the document:

* A unique ID. `Number` or `String`. Two objects are treated as the same document when they have the same ID. This is usually a UUID. The ID must be a valid filename.
* A revision tag. `Number` or `String`. If two objects have the same ID but different revision, the cloud needs to decide which should be kept and saved. For a simple use case, you can use a timestamp as the revision tag and always keep the latest object.

> In CouchDB, these properties are `_id` and `_rev`. We also uses these names in the code example.

Installation
------------

*npm*

```
npm install db-to-cloud
```

*unpkg*

```html
<script src="https://unpkg.com/db-to-cloud/dist/web/db-to-cloud.min.js"></script>

<!-- or use the ES module -->
<script src="https://unpkg.com/db-to-cloud/dist/es/db-to-cloud.min.js" type="module"></script>
```

Usage
-----

### Setup

```js
const {dbToCloud, drive: {google}} = require("db-to-cloud");

const sync = dbToCloud({
  async onGet(id) {
    return await myDB.get(id);
  },
  async onPut(doc) {
    try {
      // suppose we have a revision check in the transaction
      await myDB.put(doc);
    } catch (err) {
      if (err.type === 'outdatedDoc') {
        // the doc in the local DB is newer than the doc in the cloud
        sync.put(doc._id, err.doc._rev);
      }
    }
  },
  async onDelete(id) {
    try {
      await myDB.delete(id);
    } catch (err) {}
  },
  
  async onFirstSync() {
    const cursor = myDB.getAllCursor();
    while (!cursor.end()) {
      const {_id, _rev} = await cursor.next();
      sync.put(_id, _rev);
    }
  },
  
  compareRevision(rev1, rev2) {
    // if we use the timestamp as the revision tag, we can use a simple way to
    // decide which wins
    return rev1 - rev2;
  },
  
  async getState(drive) {
    try {
      return JSON.parse(localStorage.getItem(`cloudSync/${drive.name}/state`));
    } catch (err) {}
  },
  async setState(drive, state) {
    localStorage.setItem(`cloudSync/${drive.name}/state`, JSON.stringify(state));
  },
  
  onError(err) {
    console.error(err);
  }
});

const cloud = google({
  folder: '_MY_DB_DATA_',
  getAccessToken: async () => {
    // implement hooks to authorize the cloud
    // ...
    return token;
  }
});

sync.use(cloud);

try {
  await sync.start();
} catch (err) {
  // handle login/connection errors?
  // ...
}
```

### Update the cloud when manipulating the database

```js
// push the change to the cloud when manipulating on the local DB
const {_id, _rev} = await myDB.post(doc);
sync.put(_id, _rev);

// note that there is no sync.post. Technically, all documents already have an
// id before sent to the cloud.

const {_id, _rev} = await myDB.put(doc);
sync.put(_id, _rev);

const {_rev} = await myDB.delete(_id);
sync.delete(_id, _rev);
```

### Switch to a different drive

```js
await sync.stop();

const newDrive = github({
  user: "eight04",
  repo: "_MY_DB_DATA_",
  async getAccessToken() {
    // ...
    return token;
  }
});
sync.use(newDrive);

sync.start();
```

API
----

### dbToCloud

```js
dbToCloud({
  onGet: async (id, rev) => Document,
  onPut: async (document) => void,
  onDelete: async (id, rev) => void,
  
  onError: async (error) => void,
  
  onFirstSync: async () => void,
  
  compareRevision: (revision1, revision2) => cmpResult: Number,
  
  getState: async (drive) => state: Object,
  setState: async (drive, state) => void
  
  period?: Number,
  lockExpire?: Number
}) => sync: SyncController
```

Create a sync controller. [Usage example](#setup).

`onGet` accept a revision tag. However, you can ignore it and return/delete the latest one since it isn't useful to store outdated document in the cloud.

`onDelete` also accept a revision tag. You can use it to decide if the deletion take place or should be ignored.

Use `onError` to collect sync errors. You may want to show an error log to the user.

`onFirstSync` is called on the first sync. You can push all local documents to the cloud in this hook.

`compareRevision` is used to decide which revision should be kept. If `cmpResult > 0` then `revision1` wins. If `cmpResult < 0` then `revision2` wins.

`getState` and `setState` are used to get/store the current state of the sync process. You should save the state object to a file or `localStorage`. If `getState` returns `undefined` then it is the first sync. `drive` is a cloud drive adapter instance. You can get the drive name from `drive.name`.

`period` decides the sync interval. In minutes. Default: `5`.

When syncing, the controller will lock the cloud drive. However, if the process is interrupted (e.g. crashed) and failed to unlock, the lock will expire after `lockExpire` minutes. Default: `60`.

### sync.use

```js
sync.use(cloud) => void
```

Use a cloud adapter. The cloud is not initialized until calling `sync.start()`.

### sync.start

```js
async sync.start() => void
```

Start syncing.

Without calling this function, sending items to `sync.put`, `sync.delete`, etc, has no effect. Documents are added to queue only if this function is called.

After calling this method:

1. Initialize the cloud.
2. Load the current state.
3. Start collecting local changes.
4. Setup a timer which will pull remote changes from the drive and push local changes to the drive.

### sync.stop

```js
async sync.stop() => void
```

Stop syncing.

After calling this method:

1. Stop collecting local changes.
2. Remove the timer of the sync process.
3. Wait until all running sync task complete.
4. Uninitialize the cloud.
5. Save the current state.

### sync.put

```js
sync.put(id, revision) => void
```

Add a "put action" to the history queue.

### sync.delete

```js
sync.delete(id, revision) => void
```

Add a "delete action" to the history queue.

Create a cloud drive adapter
----------------------------

To create a working adapter, implement following methods:

### init, uninit

```js
async drive.init() => void

async drive.uninit() => void
```

Optional. These hooks will be called when `sync.start`/`sync.stop`. If the adapter uses a large dependency, it should be dynamically loaded in `init`.

### get

```js
async drive.get(path: String) => data: String
```

Read the data from the drive.

If the path doesn't exist, an error should be thrown and the `code` property should be a string `"ENOENT"`.

### put

```js
async drive.put(path: String, data: String) => void
```

Write the data to the drive. The drive should create parent folders automatically.

If the path already exists, it should overwrite the old file.

### post

```js
async drive.post(path: String, data: String) => void
```

Write the data to the drive. The drive should create parent folders automatically.

If the path already exists, an error should be thrown and the `code` property should be a string `"EEXIST"`.

### delete

```js
async drive.delete(path: String) => void
```

Delete a file. If the path doesn't exist, this function does nothing.

### list

```js
async drive.list(path: String) => Array<filename: String>
```

List all files in the folder. This is used on the first sync since we have to fetch all documents from the drive.

Currently, only the `docs` folder will be requested.

If the path doesn't exist, it can throw an ENOENT error or return an empty array.

### acquireLock, releaseLock

```js
async drive.acquireLock(expire: Number) => void

async drive.releaseLock() => void
```

Optional. The lock is acquired when a sync task starts, and is released after the sync task completes.

If these methods are not implemented, the library uses a file-based lock `lock.json` storing in the drive, using `post`, `delete`, and `get` methods.

`expire` defines the lifetime of the lock. If the sync task is interrupted and the lock is never released manually, the lock should be unlocked after `expire` minutes.

### getMeta, putMeta

```js
async drive.getMeta() => Object

async drive.putMeta(meta: Object) => void
```

Optional. Save/store metadata in the server.

If these methods are not implemented, the library stores the metadata as `meta.json` in the drive.

If the metadata is not set yet i.e. the first sync, `getMeta` should return an empty object `{}`.

### peekChanges

```js
async drive.peekChanges() => Boolean
```

Optional. Check if the cloud has been changed.

If this method is not implemented, the library `getMeta()` and check if the metadata is changed.

Changelog
---------

* 0.1.0 (Aug 28, 2018)

  - First release.
