Sync Operation Specicication
============================

This document defines the sync operation procedure. Primary goals:

1. Sync operation MUST be able to be interrupted at anytime.
2. Incomplete sync MUST not cause a data loss.
3. The database SHOULD be able to recover from an incomplete sync operation.
4. Sync operation SHOULD be able to detect merge conflicts.
5. Sync operation MUST NOT handle merge conflicts but let the application handle it.


```
                  Change        version       Change       version
Application <---------------->  Client  <----------------> Server
                 Document                    Document
```

Documents
---------

1. Any object with an ID is a document. **FIXME**: currently the ID must be a filename compatible string. See https://github.com/eight04/db-to-cloud/issues/6
2. A document SHOULD have a revision property.
3. A client MUST NOT storing multiple documents with the same ID.
4. Two documents with the same ID stored in different clients are considered the same document.

Changes
---------

A change is an object of `{_id, _rev, action}`.

1. `_id` indicates which document is changed.
2. `_rev` provides a hint to the client to resolve the merge conflicts.
3. `action` can be `put` or `delete`. It indicates which type of change has been made.

Changes are stored in the server and the client.

Server
------

The server is the single truth of source. The server (adapter) must support following operations:

1. `Lock` (`Unlock`) - a lock can only be granted by a single client at one time.
2. `Get` - get a document by ID.
3. `Put` - put a document by ID.
4. `MetadataWrite` - write metadata.
5. `MetadataRead` - read metadata.
6. `ChangesWrite` - write a sequence of changes.
7. `ChangesRead` - read a sequence of changes.

Client
------

An instance of db-to-cloud. The client must support following operations:

1. `Sync` - sync the client with the server using the information from the server and the changes queue.
2. `SyncLock` - lock the sync operation.
3. `MetadataRead` - read metadata.
4. `MetadataWrite` - write metadata.
5. `QueueChange` - queue a change event to client.

Client.QueueChange
------------------

When the application modifies a document, the application MUST queue a change to client so the client can schedule a sync. This operation may be interrupted and the change is lost. On the server, the document can be updated by another client and then get pulled without getting a merge conflict. Then the change is lost. This can be solved in two ways:

1. Implement a document-based merge conflict detection mechanism in the application.
2. Implement a mechanism to detect incomplete QueueChange. For example: add a `changeCommitted` flag to the document which is only set when `QueueChange` completed. When initializing the client, check all documents and re-queue not-committed changes. This won't work if the action is `delete` and the application doesn't store deleted documents, but it is less critical.

Sync
-----

The sync process:

```py
with client.SyncLock:
  # PeakChanges: get the version number from the server and compare it with the client's version number.
  # 
  # 1. If the server's version is greater than the client's version, the client MUST pull the changes from the server.
  # 2. If the server's version is less than the client's version, the client MUST throw an error.
  # 3. If the server's version is equal to the client's version, the client MAY push the changes to the server.
  #
  # In practical, we use `ChangesLength` as the version number.
  # 
  client_version = client.MetadataRead("version")
  server_version = server.MetadataRead("version")

  if client_version > server_version:
    raise Exception("Connected to an outdated server")
  
  if client_version == server_version and not client.ChangesQueue:
    return

  with server.Lock:
    if client_version < server_version:
      SyncPull()
    SyncPush()
```

Connected to an outdated Server
-------------------------------

This may happen when:

1. The client is connected to a server.
2. The server reverted.

In this case, the server is no longer the single truth of source. The only way to recover is to **reset all clients and the server** then start over.

Server lock is not released
---------------------------

This may happen when the `SyncPull` or `SyncPush` is interrupted. This can be solved with two methods:

1. Add a client ID to the lock. It is safe to release a lock if the client ID is the same. This method requires the application to gerenate a unique ID for each client.
2. Add a `staleTime` property to the lock. If the lock is not released after a certain time, any client can release this lock (stale). However, it is possible that multiple clients send multiple `DELETE` requests to the server and accidentally deleted a non-stale lock. So the client has to acquire another lock to ensure the operation is atomic, which, may create another stale lock.

  ```py
  if Lock.isStale:
    with Lock.DeleteLock:
      # this can be interrupted and left another stale lock on the server
      Lock.release()
  ```

See also: https://github.com/tox-dev/filelock/discussions/116

SyncPull
--------

```py
server_changes_length = server.MetadataRead("changesLength")
client_changes_length = client.MetadataRead("changesLength")
# read changes from the server
changes = server.ChangesRead(client_changes_length, server_changes_length)
# only keep the latest change for each document ID
changes = DedupChanges(changes)

for change in changes:
  localChange = client.ChangesQueue.find(lambda c: c._id == change._id)
  if localChange:
    cmpResult = application.CompareRevisions(localChange._rev, change._rev)
    if cmpResult == 0:
      # same document version
      client.ChangesQueue.remove(localChange)
      continue
    # merge conflict
    if cmpResult > 0:
      # local change is newer
      continue
    if cmpResult < 0:
      # server change is newer
      # note that we don't want to update ChangesQueue here because it may be interrupted before server.Get
      # and the change is lost
      pass
  if change.action == "put":
    doc = server.Get(change._id)
    application.Put(doc)
  elif change.action == "delete":
    application.Delete(change._id, change._rev)

client.MetadataWrite("changesLength", server_changes_length)
# store remote changes for later use
client.remoteChanges = changes
```
