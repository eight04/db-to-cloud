/* eslint-env mocha */
require("dotenv").config();

const assert = require("assert");
const readline = require("readline");

const {makeDir} = require("tempdir-yaml");
const sinon = require("sinon");
const logger = require("mocha-logger");
const fetch = require("make-fetch-happen");
const clipboardy = require("clipboardy");
const FormData = require("form-data");
const assertSet = require("assert-set");

const {dbToCloud, drive: {fsDrive, github, dropbox, onedrive, google}} = require("..");

class DummyBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
}

const _append = FormData.prototype.append;
FormData.prototype.append = function (name, blob) {
  return _append.call(this, name, blob.parts.join(""), {contentType: blob.options.type});
};

function delay(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

function question(text) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(text, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function getOneDriveAccessToken()  {
  if (process.env.AZURE_ACCESS_TOKEN && Date.now() < Number(process.env.AZURE_ACCESS_TOKEN_EXPIRE)) {
    return process.env.AZURE_ACCESS_TOKEN;
  }
  console.log("Open the URL to login:");
  console.log(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.AZURE_APP_ID}&scope=Files.ReadWrite.AppFolder&response_type=code&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient`);
  const url = await question("\nInput redirected URL:\n");
  const code = new URL(url).searchParams.get("code");
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `client_id=${process.env.AZURE_APP_ID}&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&code=${code}&grant_type=authorization_code&scope=Files.ReadWrite.AppFolder`
  });
  const result = await res.json();
  await clipboardy.write(`AZURE_ACCESS_TOKEN=${result.access_token}\nAZURE_ACCESS_TOKEN_EXPIRE=${Date.now() + result.expires_in * 1000}`);
  console.log("\nENV are copied to clipboard");
  return result.access_token;
}

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN && Date.now() < Number(process.env.GOOGLE_ACCESS_TOKEN_EXPIRE)) {
    return process.env.GOOGLE_ACCESS_TOKEN;
  }
  console.log("Open the URL to login:");
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_APP_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/drive.appdata`);
  const code = await question("\nInput the code:\n");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `client_id=${process.env.GOOGLE_APP_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&code=${code}&grant_type=authorization_code&client_secret=iPscd4omnupJFFIh-caMNV_J`
  });
  const result = await res.json();
  await clipboardy.write(`GOOGLE_ACCESS_TOKEN=${result.access_token}\nGOOGLE_ACCESS_TOKEN_EXPIRE=${Date.now() + result.expires_in * 1000}`);
  console.log("\nENV are copied to clipboard");
  return result.access_token;
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
        getAccessToken: () => process.env.GITHUB_ACCESS_TOKEN,
        fetch
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
  },
  {
    name: "onedrive",
    valid: () => process.env.AZURE_APP_ID,
    async before() {
      this.token = await getOneDriveAccessToken();
    },
    get() {
      const drive = onedrive({
        fetch,
        getAccessToken: () => this.token
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
  },
  {
    name: "google",
    valid: () => process.env.GOOGLE_APP_ID,
    async before() {
      this.token = await getGoogleAccessToken();
    },
    get() {
      const drive = google({
        fetch,
        FormData,
        Blob: DummyBlob,
        getAccessToken: () => this.token
      });
      if (!this.drive) {
        this.drive = drive;
      }
      return drive;
    },
    async after() {
      for (const meta of this.drive.fileMetaCache.values()) {
        await this.drive.delete(meta.name);
      }
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

  const {sync: sync2, data: data2, options: options2} = prepare();
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
    assert.rejects(() => sync2.syncNow(false), {code: "EEXIST"})
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
      setState: sinon.spy()
    };
    const sync = dbToCloud(options);
    const drive = getDrive();
    sync.use(drive);
    instances.push(sync);
    return {sync, options, data, drive};
  }
});
