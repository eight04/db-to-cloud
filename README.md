db-to-cloud
===========

Synchronize your database with a cloud drive i.e. Dropbox, Google Drive, OneDrive, Github, etc.

To use this library, add following properties to the document:

* `_id` - a unique ID. Two objects are treated as the same document when they have the same ID. This is usually a UUID.
* `_rev` - a revision tag. If two objects have the same `_id` but different `_rev`, the cloud need to decide which should be kept and saved. For a simple use case, you can use a timestamp as the revision tag and always keep the latest object.

These properties should be a primitive value i.e. string or number.

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

*Setup*

```js
const {dbToCloud, drive: {google}} = require("db-to-cloud");

const sync = dbToCloud({
  // hooks to handle cloud update, communicate with the local DB
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
        sync.put(doc._id);
      }
    }
  },
  async onDelete(id) {
    try {
      await myDB.delete(id);
    } catch (err) {}
  },
  
  // hooks to handle the first sync
  async onFirstSync() {
    const cursor = myDB.getAllCursor();
    while (!cursor.end()) {
      sync.put(await cursor.next());
    }
  },
  
  // hooks to resolve _rev conflict
  compareRevision(doc1, doc2) {
    // if we use the timestamp as the revision tag, we can use a simple way to
    // decide which wins
    return doc1._rev - doc2._rev;
  },
  
  // hooks to store metadata about the sync progress
  async getState(drive) {
    try {
      return JSON.parse(localStorage.getItem(`cloudSync/${drive.name}/state`));
    } catch (err) {}
  },
  async setState(drive, state) {
    localStorage.setItem(`cloudSync/${drive.name}/state`, JSON.stringify(state));
  },
  
  // hooks to collect errors
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

*In the application*

```js
// push the change to the cloud when manipulating on the local DB
doc = await myDB.post(doc);
sync.put(doc._id);
// note that there is no sync.post. Technically, all documents already have an
// id before sent to cloud.

doc = await myDB.put(doc);
sync.put(doc._id);

await myDB.delete(id);
sync.delete(id);
```

*Switch to a different drive*

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

### sync.start

Start syncing.

Without calling this function, sending items to `sync.put`, `sync.delete`, etc, has no effect. Documents are added to queue only if this function is called.

After calling this method:

1. Start collecting local changes.
2. Load the current state.
3. Setup a timer which will pull remote changes from the drive and push local changes to the drive.

### sync.stop

```js
await sync.stop();
```

Stop syncing.

After calling this method:

1. Stop collecting local changes.
2. Remove the sync task timer.
3. Wait until all running sync task complete.
4. Save the current state.

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

### acquireLock, releaseLock

```js
async drive.acquireLock(expire: Number) => void

async drive.releaseLock() => void
```

Optional. The lock is acquired when a sync task starts, and is released after the sync task completes.

If these methods are not implemented, the library will use a file-based lock workflow using `post`, `delete`, and `get` methods.

`expire` defines the lifetime of the lock. If the sync task is interrupted and the lock is never released manually, the lock should be unlocked after `expire` minutes.

Changelog
---------

* 0.1.0 (Aug 28, 2018)

  - First release.
