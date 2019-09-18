/* eslint-env mocha */
const assert = require("assert");
const fs = require("fs").promises;

const {withDir} = require("tempdir-yaml");
const sinon = require("sinon");
const logger = require("mocha-logger");

const {dbToCloud} = require("..");
const fsDrive = require("../drive/fs-drive");

function delay(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

describe("functional", () => {
  const instances = [];
  
  afterEach(async () => {
    for (const ctrl of instances) {
      await ctrl.stop();
    }
    instances.length = 0;
  });
  
  function prepare(folder, data = {}) {
    const compareRevision = sinon.spy((a, b) => a - b);
    const options = {
      fetchDelay: 0,
      onGet: sinon.spy(async (_id) => {
        await delay(options.fetchDelay);
        return data[_id];
      }),
      onPut: sinon.spy(doc => {
        if (!data[doc._id] || compareRevision(data[doc._id]._rev, doc._rev) < 0) {
          data[doc._id] = doc;
        }
      }),
      onDelete: sinon.spy((_id, _rev) => {
        if (data[_id] && compareRevision(data[_id]._rev, _rev) < 0) {
          delete data[_id];
        }
      }),
      onError: sinon.spy(),
      onFirstSync: sinon.spy(() => {
        for (const doc of Object.values(data)) {
          // eslint-disable-next-line no-use-before-define
          sync.put(doc._id, doc._rev);
        }
      }),
      compareRevision,
      getState: sinon.spy(),
      setState: sinon.spy()
    };
    const sync = dbToCloud(options);
    sync.use(fsDrive({
      folder
    }));
    instances.push(sync);
    return {sync, options, data};
  }

  it("setup with empty drive", () =>
    withDir(async resolve => {
      const data = {
        1: {
          _id: 1,
          _rev: 1,
          foo: "bar"
        },
        2: {
          _id: 2,
          _rev: 1,
          bar: "baz"
        }
      };
      const {sync, options} = prepare(resolve("."), data);
      await sync.start();
      
      logger.log("started, data should be written to drive");
      
      {
        const doc = JSON.parse(await fs.readFile(resolve("docs/2.json"), "utf8"));
        assert.deepStrictEqual(doc, data[2]);
        const meta = JSON.parse(await fs.readFile(resolve("changes/meta.json"), "utf8"));
        assert.equal(meta.lastChange, 2);
        const changes = JSON.parse(await fs.readFile(resolve("changes/0.json"), "utf8"));
        assert.deepStrictEqual(changes, [
          {
            _id: 1,
            _rev: 1,
            action: "put"
          },
          {
            _id: 2,
            _rev: 1,
            action: "put"
          }
        ]);
      }
      
      logger.log("getState/setState should be able to access drive name");
      
      assert.equal(options.getState.lastCall.args[0].name, "fs-drive");
      
      logger.log("start and sync with the second instance");
      
      const {sync: sync2, data: data2} = prepare(resolve("."));
      await sync2.start();
      assert.deepStrictEqual(data2, data);
      
      logger.log("change should flow to other instances");
      
      data2[3] = {
        _id: 3,
        _rev: 1,
        baz: "bak"
      };
      sync2.put(3, 1);
      data2[1]._rev = 2;
      data2[1].foo = "foo";
      sync2.put(1, 2);
      delete data2[2];
      sync2.delete(2, 2);
      
      await sync2.syncNow();
      await sync.syncNow();
      
      assert.deepStrictEqual(data, data2);
      assert.equal(data[1].foo, "foo");
      assert.equal(data[2], undefined);
      assert.equal(data[3].baz, "bak");
      
      logger.log("100 changes");
      
      for (let i = 0; i < 100; i++) {
        data[4 + i] = {
          _id: 4 + i,
          _rev: 1,
          value: Math.floor(Math.random() * 100)
        };
        sync.put(4 + i, 1);
      }
      
      await sync.syncNow();
      await sync2.syncNow();
      
      assert.deepStrictEqual(data2, data);
      
      logger.log("cloud is locked while syncing");
      
      options.fetchDelay = 500;
      
      data[1].foo = "not foo";
      data[1]._rev++;
      sync.put(1, data[1]._rev);
      const p = sync.syncNow();
      await assert.rejects(sync2.syncNow, {code: "EEXIST"});
      await p;
      
      options.fetchDelay = 0;
    })
  );
});
