db-to-cloud
===========

[![Build Status](https://travis-ci.com/eight04/db-to-cloud.svg?branch=master)](https://travis-ci.com/eight04/db-to-cloud)
[![codecov](https://codecov.io/gh/eight04/db-to-cloud/branch/master/graph/badge.svg)](https://codecov.io/gh/eight04/db-to-cloud)

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
<!-- export to global variable "dbToCloud" -->
<script src="https://unpkg.com/db-to-cloud/dist/db-to-cloud.min.js"></script>
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
  }
});

const cloud = google({
  getAccessToken: async () => {
    // implement a token manager to authorize the cloud
    // ...
    return token;
  }
});

sync.use(cloud);

try {
  await sync.start();
} catch (err) {
  if (err.code === 401) {
    // handle login error, revoke the token
    // ...
  }
}

// trigger sync every 30 minutes
let syncTimer = setInterval(sync.syncNow, 30 * 60 * 1000);
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
clearInterval(syncTimer);

await sync.stop();

const newDrive = github({
  owner: "eight04",
  repo: "_MY_DB_DATA_",
  async getAccessToken() {
    // ...
    return token;
  }
});
sync.use(newDrive);

await sync.start();

syncTimer = setInterval(sync.syncNow, 30 * 60 * 1000);
```

API
----

This module exports following properties:

* `dbToCloud`: Initialize the sync controller.
* `drive`: A cloudName/cloudFactory map.

### dbToCloud

```js
dbToCloud({
  onGet: async (id, rev) => Document,
  onPut: async (document) => void,
  onDelete: async (id, rev) => void,
  
  onFirstSync: async () => void,
  
  compareRevision: (revision1, revision2) => cmpResult: Number,
  
  getState: async (drive) => state: Object,
  setState: async (drive, state) => void,
  
  onWarn?: (message: String) => void,
  onProgress?: (progressEvent: Object) => void,
  
  lockExpire?: Number
}) => sync: SyncController
```

Create a sync controller. [Usage example](#setup).

`onGet` accept a revision tag. However, you can ignore it and return/delete the latest one since it isn't useful to store outdated document in the cloud.

`onDelete` also accept a revision tag. You can use it to decide if the deletion take place or should be ignored.

`onFirstSync` is called on the first sync. You can push all local documents to the cloud in this hook.

`compareRevision` is used to decide which revision should be kept. If `cmpResult > 0` then `revision1` wins. If `cmpResult < 0` then `revision2` wins.

`getState` and `setState` are used to get/store the current state of the sync process. You should save the state object to a file or `localStorage`. If `getState` returns `undefined` then it is the first sync. `drive` is a cloud drive adapter instance. You can get the drive name from `drive.name`.

Use `onWarn` to collect warnings. Default: `console.error`

Use `onProgress` to collect sync progress. The type of `progressEvent`:

```js
{
  phase: String,
  total?: Number,
  loaded?: Number,
  change?: {
    _id,
    _rev?,
    action
  }
}
```

`phase` can be `start`, `end`, `pull`, or `push`:

* `start` - a new sync task starts.
* `end` - the entire sync task completes.
* `pull` - start pulling a change.
* `push` - start pushing a change.

When the phase is `pull` or `push`, `total` and `loaded` indicates how many changes should be processed and how many changes completed in the current phase.

Note that `change._rev` is undefined in the first pull. The library doesn't know the revision until the data is fetched.

When the sync task starts, the cloud drive will be locked. However, if the process is interrupted (e.g. the browser crashed) and failed to unlock, the lock will expire after `lockExpire` minutes. Default: `60`.

### sync.use

```js
sync.use(cloud: CloudAdapter) => void
```

Use a cloud adapter.

### sync.start

```js
async sync.start() => void
```

Start syncing.

Without calling this function, sending items to `sync.put`, `sync.delete`, etc, has no effect. Documents are added to the queue only if this function is called.

Calling this function also triggers the initial sync.

### sync.stop

```js
async sync.stop() => void
```

Stop syncing.

This method do following stuff:

1. Stop collecting local changes.
2. Wait until all running sync task complete.
3. Uninitialize the cloud.
4. Save the current state.

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

### sync.syncNow

```js
async sync.syncNow(peekChanges: Boolean = true) => void
```

Sync now. Pull changes from the cloud and push local changes to the cloud.

When `peekChanges` is `true`, the controller calls `cloud.peekChanges` to check if changes are available.

Drives
-------

The library includes 5 cloud drive adapters.

Various adapters require browser builtins (e.g. `fetch`, `FormData`, `Blob`). You can check how do we implement such features in Node.js by looking into the test file.

### fsDrive

```js
fsDrive({
  folder: String,
  getFs?: async () => fs.promises
}) => CloudAdapter
```

This adapter stores data to local disk.

The browser build doesn't include this adapter.

### dropbox

```js
dropbox({
  getAccessToken: async () => token: String,
  fetch?: Function
}) => CloudAdapter
```

This adapter stores data to Dropbox.

If `fetch` is not supplied, use global variable `fetch`.

### github

```js
github({
  getAccessToken: async () => token: String,
  owner: String,
  repo: String,
  fetch?: Function
}) => CloudAdapter
```

This adapter stores data to Github repository `owner/repo`.

If `fetch` is not supplied, use global variable `fetch`.

### google

```js
google({
  getAccessToken: async () => token: String,
  fetch?,
  FormData?,
  Blob?
}) => CloudAdapter
```

This adapter stores data to Google Drive.

If `fetch`/`FormData`/`Blob` is not supplied, use the global variable.

### onedrive

```js
onedrive({
  getAccessToken: async () => token: String,
  fetch?
}) => CloudAdapter
```

This adapter stores data to OneDrive.

If `fetch` is not supplied, use the global variable.

User-defined cloud drive adapter
--------------------------------

To create a working adapter, create an object with following methods:

* *init, uninit*

    ```js
    async drive.init() => void

    async drive.uninit() => void
    ```

    Optional. These hooks will be called when `sync.start`/`sync.stop`. If the adapter uses a large dependency, it should be dynamically loaded in `init`.

* *get*

    ```js
    async drive.get(path: String) => data: String
    ```

    Read the data from the drive.

    If the path doesn't exist, an error should be thrown and the `code` property should be a string `"ENOENT"` or a number `404`.

* *put*

    ```js
    async drive.put(path: String, data: String) => void
    ```

    Write the data to the drive. The drive should create parent folders automatically.

    If the path already exists, it should overwrite the old file.

* *post*

    ```js
    async drive.post(path: String, data: String) => void
    ```

    Write the data to the drive. The drive should create parent folders automatically.

    If the path already exists, an error should be thrown and the `code` property should be a string `"EEXIST"`.

* *delete*

    ```js
    async drive.delete(path: String) => void
    ```

    Delete a file. If the path doesn't exist, this function does nothing.

* *list*

    ```js
    async drive.list(path: String) => Array<filename: String>
    ```

    List all files in the folder. This is used on the first sync since we have to fetch all documents from the drive.

    Currently, only the `docs` folder will be requested.

    If the path doesn't exist, it can throw an ENOENT/404 error or return an empty array.

* *acquireLock, releaseLock*

    ```js
    async drive.acquireLock(expire: Number) => void

    async drive.releaseLock() => void
    ```

    Optional. The lock is acquired when a sync task starts, and is released after the sync task completes.

    If these methods are not implemented, the library uses a file-based lock `lock.json` storing in the drive, using `post`, `delete`, and `get` methods.

    `expire` defines the lifetime of the lock. If the sync task is interrupted and the lock is never released manually, the lock should be unlocked after `expire` minutes.

* *getMeta, putMeta*

    ```js
    async drive.getMeta() => Object

    async drive.putMeta(meta: Object) => void
    ```

    Optional. Save/store metadata in the server.

    If these methods are not implemented, the library stores the metadata as `meta.json` in the drive.

    If the metadata is not set yet i.e. the first sync, `getMeta` should return an empty object `{}`.

* *peekChanges*

    ```js
    async drive.peekChanges() => Boolean
    ```

    Optional. Check if the cloud has been changed.

    If this method is not implemented, the library `getMeta()` and check if the metadata is changed.
    
If your adapter uses an access token, make sure to throw a proper authentication error when authentication failed. The error object should have a `code` property and the value must be a number `401` (the HTTP status code of the auth error). You can use the `db-to-cloud/lib/request` module.

Changelog
---------

* 0.4.1 (Oct 9, 2019)

  - Fix: ignore `start()`/`stop()` if already started/stopped.

* 0.4.0 (Oct 4, 2019)

  - **Breaking: the signature of `onProgress` is changed.** It now receives an event object.

* 0.3.1 (Oct 3, 2019)

  - Add: `onProgress` hook.

* 0.3.0 (Sep 30, 2019)

  - **Breaking: the file structure stored in the drive is changed. Store revision tag along with the doc.**

* 0.2.0 (Sep 29, 2019)

  - Breaking: drop dropbox/github SDK.
  - Change: disable babel-regenerator. The browser build now includes generator functions.

* 0.1.0 (Sep 24, 2019)

  - First release.
