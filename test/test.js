/* eslint-env mocha */
require("dotenv").config();

const assert = require("assert");

const {makeDir} = require("tempdir-yaml");
const sinon = require("sinon");
const logger = require("mocha-logger");
const fetch = require("node-fetch");

const {dbToCloud, drive: {fsDrive, github, dropbox}} = require("..");

function delay(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

const ADAPTERS = [
  {
    name: "fs-drive",
    valid: () => true,
    async before() {
      this.dir = await makeDir();
    },
    async after() {
      await this.dir.cleanup();
    },
    get() {
      return fsDrive({
        folder: this.dir.resolve(".")
      });
    }
  },
  {
    name: "github",
    valid: () => process.env.GITHUB_ACCESS_TOKEN,
    get() {
      const drive = github({
        owner: process.env.GITHUB_OWNER,
        repo: "_db_to_cloud_test",
        getAccessToken: () => process.env.GITHUB_ACCESS_TOKEN
      });
      if (!this.drive) {
        this.drive = drive;
      }
      return drive;
    },
    async after() {
      for (const path of this.drive.shaCache.keys()) {
        await this.drive.delete(path);
      }
    }
  },
  {
    name: "dropbox",
    valid: () => process.env.DROPBOX_ACCESS_TOKEN,
    get() {
      const drive = dropbox({
        fetch,
        getAccessToken: () => process.env.DROPBOX_ACCESS_TOKEN
      });
      if (!this.drive) {
        this.drive = drive;
      }
      return drive;
    },
    async after() {
      await this.drive.delete("docs");
      await this.drive.delete("changes");
      await this.drive.delete("meta.json");
    }
  }
];

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
  await sync.start();

  logger.log("started, data should be written to drive");

  {
    const meta = await sync.drive().getMeta();
    assert.equal(meta.lastChange, 2);
    const doc = JSON.parse(await drive.get("docs/2.json"));
    assert.deepStrictEqual(doc, data[2]);
    const changes = JSON.parse(await drive.get("changes/0.json"));
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

  assert(drive.name);
  assert.equal(options.getState.lastCall.args[0].name, drive.name);

  logger.log("start and sync with the second instance");

  const {sync: sync2, data: data2} = prepare();
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

  options.fetchDelay = 1000;

  data[1].foo = "not foo";
  data[1]._rev++;
  sync.put(1, data[1]._rev);
  const p = sync.syncNow();
  await delay(500);
  await Promise.all([
    p,
    assert.rejects(sync2.syncNow, {code: "EEXIST"})
  ]);

  options.fetchDelay = 0;
}

describe("functional", () => {
  const instances = [];
  
  afterEach(async () => {
    for (const ctrl of instances) {
      await ctrl.stop();
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
        await suite(data => prepare(getDrive, data));
      });
    });
  }
  
  function prepare(getDrive, data = {}) {
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
    const drive = getDrive();
    sync.use(drive);
    instances.push(sync);
    return {sync, options, data, drive};
  }
});
