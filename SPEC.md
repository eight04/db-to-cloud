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
2. `MetadataRead` - read metadata.
3. `MetadataWrite` - write metadata.
4. `QueueChange` - queue a change event to client.

Client.QueueChange
------------------

When the application modifies a document, the application MUST queue a change to client so the client can schedule a sync. This operation may be interrupted and the change is lost. On the server, the document can be updated by another client and then get pulled without getting a merge conflict. Then the change is lost. This can be solved in two ways:

1. Implement a document-based merge conflict detection mechanism in the application.
2. Add a `changeCommitted` flag to the document which is only set when `QueueChange` completed. When initializing the client, check all documents and re-queue not-committed changes. This won't work if the action is `delete` and the application doesn't store deleted documents, but it is less critical.

