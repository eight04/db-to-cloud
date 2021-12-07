/* eslint-env mocha */
require("dotenv").config();

const assert = require("assert");

const sinon = require("sinon");
const logger = require("mocha-logger");
const assertSet = require("assert-set");

const ADAPTERS = require("./adapter");

const {dbToCloud} = require("..");

function delay(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

async function suite(prepare) {
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
  const {sync, options, drive} = prepare(data);
  
  assert(!sync.isInit());
  
  await sync.init();
  
  assert(sync.isInit());

  logger.log("started, try to modify db before the first sync");
  
  sync.delete(3, 1);
  sync.put(1, 1);

  await sync.syncNow();

  logger.log("data should be written to drive");

  {
    const meta = await sync.drive().getMeta();
    assert.equal(meta.lastChange, 3);
    const {doc} = JSON.parse(await drive.get("docs/2.json"));
    assert.deepStrictEqual(doc, data[2]);
    const changes = JSON.parse(await drive.get("changes/0.json"));
    assert.deepStrictEqual(changes, [
      {
        _id: 3,
        _rev: 1,
        action: "delete"
      },
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
    const args = options.onProgress.getCalls().map(c => c.args[0]);
    assert.deepStrictEqual(args, [
      {
        phase: 'start'
      },
      {
        phase: 'push',
        total: 3,
        loaded: 0,
        change: {
          _id: 3,
          _rev: 1,
          action: "delete"
        }
      },
      {
        phase: 'push',
        total: 3,
        loaded: 1,
        change: {
          _id: 1,
          _rev: 1,
          action: "put"
        }
      },
      {
        phase: 'push',
        total: 3,
        loaded: 2,
        change: {
          _id: 2,
          _rev: 1,
          action: "put"
        }
      },
      {
        phase: "end"
      }
    ]);
  }

  logger.log("getState/setState should be able to access drive name");

  assert(drive.name);
  assert.equal(options.getState.lastCall.args[0].name, drive.name);

  logger.log("start and sync with the second instance");

  const {sync: sync2, data: data2, options: options2} = prepare({}, {retryMaxAttempts: 0});
  await sync2.init();
  await sync2.syncNow();
  assert.deepStrictEqual(data2, data);
  {
    const args = options2.onProgress.getCalls().map(c => c.args[0]);
    assert.equal(args.length, 4);
    assert.deepStrictEqual(args[0], {phase: 'start'});
    assert.deepStrictEqual(args[3], {phase: 'end'});
    
    assert.equal(args[1].phase, 'pull');
    assert.equal(args[1].total, 2);
    assert.equal(args[1].loaded, 0);
    
    assert.equal(args[2].phase, 'pull');
    assert.equal(args[2].total, 2);
    assert.equal(args[2].loaded, 1);
    
    // we don't care about the order
    assertSet.equal([args[1].change, args[2].change], [
      {
        // FIXME: https://github.com/eight04/db-to-cloud/issues/6
        _id: "1",
        action: "put"
      },
      {
        _id: "2",
        action: "put"
      }
    ]);    
  }

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
  
  // we only test this on local disk
  if (drive.name === "fs-drive") {
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
  }

  logger.log("cloud is locked while syncing");

  options.fetchDelay = 3000;

  data[1].foo = "not foo";
  data[1]._rev++;
  sync.put(1, data[1]._rev);
  const p = sync.syncNow();
  await delay(1500);
  await Promise.all([
    p,
    assert.rejects(
      () => sync2.syncNow(false),
      {message: /the database is locked/i}
    )
  ]);

  options.fetchDelay = 0;
}

describe("functional", () => {
  const instances = [];
  
  afterEach(async function () {
    this.timeout(20 * 1000);
    for (const ctrl of instances) {
      await ctrl.uninit();
      assert(!ctrl.isInit());
    }
    instances.length = 0;
  });
  
  for (const adapter of ADAPTERS) {
    describe(adapter.name, function() {
      if (!adapter.valid()) {
        logger.log(`invalid context, skip ${adapter.name}`);
        return;
      }
      
      before(async function() {
        this.timeout(5 * 60 * 1000);
        if (adapter.before) {
          await adapter.before();
        }
      });
      
      after(async function() {
        this.timeout(5 * 60 * 1000);
        if (adapter.after) {
          await adapter.after();
        }
      });
      
      it("run suite", async function() {
        this.timeout(5 * 60 * 1000);
        const getDrive = adapter.get.bind(adapter);
        await suite((...args) => prepare(getDrive, ...args));
      });
    });
  }
  
  function prepare(getDrive, data = {}, driveOptions) {
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
      onWarn: sinon.spy(),
      onFirstSync: sinon.spy(() => {
        for (const doc of Object.values(data)) {
          // eslint-disable-next-line no-use-before-define
          sync.put(doc._id, doc._rev);
        }
      }),
      onProgress: sinon.spy(),
      compareRevision,
      getState: sinon.spy(),
      setState: sinon.spy(),
      ...driveOptions
    };
    const sync = dbToCloud(options);
    const drive = getDrive();
    sync.use(drive);
    instances.push(sync);
    return {sync, options, data, drive};
  }
});
