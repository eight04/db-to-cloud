var dbToCloud = (function (exports) {
  'use strict';

  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function asyncGeneratorStep(n, t, e, r, o, a, c) {
    try {
      var i = n[a](c),
        u = i.value;
    } catch (n) {
      return void e(n);
    }
    i.done ? t(u) : Promise.resolve(u).then(r, o);
  }
  function _asyncToGenerator(n) {
    return function () {
      var t = this,
        e = arguments;
      return new Promise(function (r, o) {
        var a = n.apply(t, e);
        function _next(n) {
          asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
        }
        function _throw(n) {
          asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
        }
        _next(void 0);
      });
    };
  }
  function _createForOfIteratorHelper(r, e) {
    var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (!t) {
      if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
        t && (r = t);
        var n = 0,
          F = function () {};
        return {
          s: F,
          n: function () {
            return n >= r.length ? {
              done: !0
            } : {
              done: !1,
              value: r[n++]
            };
          },
          e: function (r) {
            throw r;
          },
          f: F
        };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o,
      a = !0,
      u = !1;
    return {
      s: function () {
        t = t.call(r);
      },
      n: function () {
        var r = t.next();
        return a = r.done, r;
      },
      e: function (r) {
        u = !0, o = r;
      },
      f: function () {
        try {
          a || null == t.return || t.return();
        } finally {
          if (u) throw o;
        }
      }
    };
  }
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
      value: t,
      enumerable: !0,
      configurable: !0,
      writable: !0
    }) : e[r] = t, e;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e,
        n,
        i,
        u,
        a = [],
        f = !0,
        o = !1;
      try {
        if (i = (t = t.call(r)).next, 0 === l) {
          if (Object(t) !== t) return;
          f = !1;
        } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
      } catch (r) {
        o = !0, n = r;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function (r) {
        return Object.getOwnPropertyDescriptor(e, r).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
        _defineProperty(e, r, t[r]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
        Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
      });
    }
    return e;
  }
  function _objectWithoutProperties(e, t) {
    if (null == e) return {};
    var o,
      r,
      i = _objectWithoutPropertiesLoose(e, t);
    if (Object.getOwnPropertySymbols) {
      var n = Object.getOwnPropertySymbols(e);
      for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
    }
    return i;
  }
  function _objectWithoutPropertiesLoose(r, e) {
    if (null == r) return {};
    var t = {};
    for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
      if (-1 !== e.indexOf(n)) continue;
      t[n] = r[n];
    }
    return t;
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  function createLock({
    maxActiveReader = Infinity
  } = {}) {
    var firstTask;
    var lastTask;
    var activeReader = 0;
    var self = {
      read: fn => que(fn, false),
      write: fn => que(fn, true),
      length: 0
    };
    return self;
    function que(fn, block) {
      var task = createTask({
        fn,
        block
      });
      if (!lastTask) {
        firstTask = lastTask = task;
      } else {
        lastTask.next = task;
        task.prev = lastTask;
        lastTask = task;
        if (!firstTask) {
          firstTask = lastTask;
        }
      }
      self.length++;
      deque();
      return task.q.promise;
    }
    function defer() {
      var o = {};
      o.promise = new Promise((resolve, reject) => {
        o.resolve = resolve;
        o.reject = reject;
      });
      return o;
    }
    function createTask({
      fn,
      block = false,
      prev,
      next,
      q = defer(),
      q2 = fn.length ? defer() : null
    }) {
      return {
        fn,
        block,
        prev,
        next,
        q,
        q2
      };
    }
    function deque() {
      var task = firstTask;
      if (!task || task.block && task.prev || task.prev && task.prev.block || activeReader >= maxActiveReader) {
        return;
      }
      if (!task.block) {
        activeReader++;
      }
      firstTask = task.next;
      var result;
      try {
        result = task.fn(task.q2 && task.q2.resolve);
      } catch (err) {
        task.q.reject(err);
        // auto release with sync error
        // q2 is useless in this case
        onDone();
        return;
      }
      if (task.q2) {
        task.q2.promise.then(_onDone);
      }
      if (result && result.then) {
        var pending = result.then(task.q.resolve, task.q.reject);
        if (!task.q2) {
          pending.then(onDone);
        }
      } else {
        task.q.resolve(result);
        if (!task.q2) {
          // it's a sync function and you don't want to release it manually, why
          // do you need a lock?
          onDone();
          return;
        }
      }
      deque();
      function onDone() {
        _onDone();
      }
      function _onDone(afterDone) {
        if (task.prev) {
          task.prev.next = task.next;
        }
        if (task.next) {
          task.next.prev = task.prev;
        }
        if (lastTask === task) {
          lastTask = task.prev;
        }
        if (!task.block) {
          activeReader--;
        }
        self.length--;
        if (afterDone) {
          afterDone();
        }
        deque();
      }
    }
  }

  class LockError extends Error {
    constructor(expire) {
      super("The database is locked. Will expire at ".concat(new Date(expire).toLocaleString()));
      this.expire = expire;
      this.name = "LockError";
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, LockError);
      }
    }
  }

  function debounced(fn) {
    var timer = 0;
    var q;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(run);
      if (!q) {
        q = defer();
      }
      return q.promise;
    };
    function run() {
      Promise.resolve(fn()).then(q.resolve, q.reject);
      timer = 0;
      q = null;
    }
    function defer() {
      var o = {};
      o.promise = new Promise((resolve, reject) => {
        o.resolve = resolve;
        o.reject = reject;
      });
      return o;
    }
  }
  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }
  function xmlToJSON(node) {
    // FIXME: xmldom doesn't support children
    var children = Array.prototype.filter.call(node.childNodes, i => i.nodeType === 1);
    if (!children.length) {
      return node.textContent;
    }
    var o = {};
    var _iterator = _createForOfIteratorHelper(children),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var c = _step.value;
        var cResult = xmlToJSON(c);
        if (!o[c.localName]) {
          o[c.localName] = cResult;
        } else if (!Array.isArray(o[c.localName])) {
          var list = [o[c.localName]];
          list.push(cResult);
          o[c.localName] = list;
        } else {
          o[c.localName].push(cResult);
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return o;
  }
  function createXMLParser(DOMParser) {
    var parser;
    return function parseXML(text) {
      if (!parser) {
        parser = new DOMParser();
      }
      var xml = parser.parseFromString(text, "application/xml");
      return xmlToJSON(xml);
    };
  }

  function buildDrive(_drive) {
    var drive = Object.create(_drive);
    drive.get = /*#__PURE__*/function () {
      var _ref = _asyncToGenerator(function* (path) {
        return JSON.parse(yield _drive.get(path));
      });
      return function (_x) {
        return _ref.apply(this, arguments);
      };
    }();
    drive.put = /*#__PURE__*/function () {
      var _ref2 = _asyncToGenerator(function* (path, data) {
        return yield _drive.put(path, JSON.stringify(data));
      });
      return function (_x2, _x3) {
        return _ref2.apply(this, arguments);
      };
    }();
    drive.post = /*#__PURE__*/function () {
      var _ref3 = _asyncToGenerator(function* (path, data) {
        return yield _drive.post(path, JSON.stringify(data));
      });
      return function (_x4, _x5) {
        return _ref3.apply(this, arguments);
      };
    }();
    drive.isInit = false;
    if (!drive.acquireLock) {
      drive.acquireLock = acquireLock;
      drive.releaseLock = releaseLock;
    }
    if (!drive.getMeta) {
      drive.getMeta = getMeta;
      drive.putMeta = putMeta;
    }
    if (!drive.peekChanges) {
      drive.peekChanges = peekChanges;
    }
    return drive;
    function acquireLock(_x6) {
      return _acquireLock.apply(this, arguments);
    }
    function _acquireLock() {
      _acquireLock = _asyncToGenerator(function* (expire) {
        try {
          yield this.post("lock.json", {
            expire: Date.now() + expire * 60 * 1000
          });
        } catch (err) {
          if (err.code !== "EEXIST") {
            throw err;
          }
          var data = yield this.get("lock.json");
          if (Date.now() > data.expire) {
            // FIXME: this may delete a different lock created by other instances
            yield this.delete("lock.json");
            throw new Error("Found expired lock, please try again");
          }
          throw new LockError(data.expire);
        }
      });
      return _acquireLock.apply(this, arguments);
    }
    function releaseLock() {
      return _releaseLock.apply(this, arguments);
    }
    function _releaseLock() {
      _releaseLock = _asyncToGenerator(function* () {
        yield this.delete("lock.json");
      });
      return _releaseLock.apply(this, arguments);
    }
    function getMeta() {
      return _getMeta.apply(this, arguments);
    }
    function _getMeta() {
      _getMeta = _asyncToGenerator(function* () {
        try {
          return yield this.get("meta.json");
        } catch (err) {
          if (err.code === "ENOENT" || err.code === 404) {
            return {};
          }
          throw err;
        }
      });
      return _getMeta.apply(this, arguments);
    }
    function putMeta(_x7) {
      return _putMeta.apply(this, arguments);
    }
    function _putMeta() {
      _putMeta = _asyncToGenerator(function* (data) {
        yield this.put("meta.json", data);
      });
      return _putMeta.apply(this, arguments);
    }
    function peekChanges(_x8) {
      return _peekChanges.apply(this, arguments);
    }
    function _peekChanges() {
      _peekChanges = _asyncToGenerator(function* (oldMeta) {
        var newMeta = yield this.getMeta();
        return newMeta.lastChange !== oldMeta.lastChange;
      });
      return _peekChanges.apply(this, arguments);
    }
  }
  function dbToCloud({
    onGet,
    onPut,
    onDelete,
    onFirstSync,
    onWarn = console.error,
    onProgress,
    compareRevision,
    getState,
    setState,
    lockExpire = 60,
    retryMaxAttempts = 5,
    retryExp = 1.5,
    retryDelay = 10
  }) {
    var _drive2;
    var state;
    var meta;
    var changeCache = new Map();
    var saveState = debounced(() => setState(_drive2, state));
    var revisionCache = new Map();
    var lock = createLock();
    return {
      use,
      init,
      uninit,
      put,
      delete: delete_,
      syncNow,
      drive: () => _drive2,
      isInit: () => Boolean(state && state.enabled)
    };
    function use(newDrive) {
      _drive2 = buildDrive(newDrive);
    }
    function init() {
      return lock.write(/*#__PURE__*/_asyncToGenerator(function* () {
        if (state && state.enabled) {
          return;
        }
        if (!_drive2) {
          throw new Error("cloud drive is undefined");
        }
        state = (yield getState(_drive2)) || {};
        state.enabled = true;
        if (!state.queue) {
          state.queue = [];
        }
      }));
    }
    function uninit() {
      return lock.write(/*#__PURE__*/_asyncToGenerator(function* () {
        if (!state || !state.enabled) {
          return;
        }
        state = meta = null;
        changeCache.clear();
        revisionCache.clear();
        if (_drive2.uninit && _drive2.isInit) {
          yield _drive2.uninit();
          _drive2.isInit = false;
        }
        yield saveState();
      }));
    }
    function syncPull() {
      return _syncPull.apply(this, arguments);
    }
    function _syncPull() {
      _syncPull = _asyncToGenerator(function* () {
        meta = yield _drive2.getMeta();
        if (!meta.lastChange || meta.lastChange === state.lastChange) {
          // nothing changes
          return;
        }
        var changes = [];
        if (!state.lastChange) {
          // pull everything
          changes = (yield _drive2.list("docs")).map(name => ({
            action: 'put',
            _id: name.slice(0, -5)
          }));
        } else {
          var end = Math.floor((meta.lastChange - 1) / 100); // inclusive end
          var i = Math.floor(state.lastChange / 100);
          while (i <= end) {
            var newChanges = yield _drive2.get("changes/".concat(i, ".json"));
            changeCache.set(i, newChanges);
            changes = changes.concat(newChanges);
            i++;
          }
          changes = changes.slice(state.lastChange % 100);
        }
        // merge changes
        var idx = new Map();
        var _iterator = _createForOfIteratorHelper(changes),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var change = _step.value;
            idx.set(change._id, change);
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        var loaded = 0;
        var _iterator2 = _createForOfIteratorHelper(idx),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var _step2$value = _slicedToArray(_step2.value, 2),
              id = _step2$value[0],
              _change = _step2$value[1];
            var doc = void 0,
              _rev = void 0;
            if (onProgress) {
              onProgress({
                phase: 'pull',
                total: idx.size,
                loaded,
                change: _change
              });
            }
            if (_change.action === "delete") {
              yield onDelete(id, _change._rev);
            } else if (_change.action === "put") {
              try {
                var _yield$_drive2$get = yield _drive2.get("docs/".concat(id, ".json"));
                doc = _yield$_drive2$get.doc;
                _rev = _yield$_drive2$get._rev;
              } catch (err) {
                if (err.code === "ENOENT" || err.code === 404) {
                  onWarn("Cannot find ".concat(id, ". Is it deleted without updating the history?"));
                  loaded++;
                  continue;
                }
                throw err;
              }
              yield onPut(doc);
            }
            // record the remote revision
            var rev = _change._rev || _rev;
            if (rev) {
              revisionCache.set(id, rev);
            }
            loaded++;
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
        state.lastChange = meta.lastChange;
        yield saveState();
      });
      return _syncPull.apply(this, arguments);
    }
    function syncPush() {
      return _syncPush.apply(this, arguments);
    }
    function _syncPush() {
      _syncPush = _asyncToGenerator(function* () {
        if (!state.queue.length) {
          // nothing to push
          return;
        }
        // snapshot
        var changes = state.queue.slice();

        // merge changes
        var idx = new Map();
        var _iterator3 = _createForOfIteratorHelper(changes),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var _change2 = _step3.value;
            idx.set(_change2._id, _change2);
          }
          // drop outdated change
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
        var newChanges = [];
        var _iterator4 = _createForOfIteratorHelper(idx.values()),
          _step4;
        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var _change3 = _step4.value;
            // FIXME: is it safe to assume that the local doc is newer when
            // remoteRev is undefined?
            var remoteRev = revisionCache.get(_change3._id);
            if (remoteRev !== undefined && compareRevision(_change3._rev, remoteRev) <= 0) {
              continue;
            }
            newChanges.push(_change3);
          }
          // FIXME: there should be no need to push data when !newChanges.length

          // start pushing
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
        var loaded = 0;
        for (var _i = 0, _newChanges = newChanges; _i < _newChanges.length; _i++) {
          var change = _newChanges[_i];
          if (onProgress) {
            onProgress({
              phase: 'push',
              loaded,
              total: newChanges.length,
              change
            });
          }
          if (change.action === "delete") {
            yield _drive2.delete("docs/".concat(change._id, ".json"));
          } else if (change.action === "put") {
            var doc = yield onGet(change._id, change._rev);
            yield _drive2.put("docs/".concat(change._id, ".json"), {
              doc,
              _rev: change._rev
            });
          }
          revisionCache.set(change._id, change._rev);
          loaded++;
        }

        // push changes
        var lastChanges;
        var index;
        // meta is already pulled in syncPull
        if (meta.lastChange) {
          index = Math.floor(meta.lastChange / 100);
          var len = meta.lastChange % 100;
          lastChanges = len ? changeCache.get(index) || (yield _drive2.get("changes/".concat(index, ".json"))) : [];
          // it is possible that JSON data contains more records defined by
          // meta.lastChange
          lastChanges = lastChanges.slice(0, len).concat(newChanges);
        } else {
          // first sync
          index = 0;
          lastChanges = newChanges;
        }
        for (var i = 0; i * 100 < lastChanges.length; i++) {
          var window = lastChanges.slice(i * 100, (i + 1) * 100);
          yield _drive2.put("changes/".concat(index + i, ".json"), window);
          changeCache.set(index + i, window);
        }
        meta.lastChange = (meta.lastChange || 0) + newChanges.length;
        yield _drive2.putMeta(meta);
        state.queue = state.queue.slice(changes.length);
        state.lastChange = meta.lastChange;
        yield saveState();
      });
      return _syncPush.apply(this, arguments);
    }
    function sync() {
      return _sync.apply(this, arguments);
    }
    function _sync() {
      _sync = _asyncToGenerator(function* () {
        var tried = 0;
        var wait = retryDelay;
        var lastErr;
        while (true) {
          // eslint-disable-line no-constant-condition
          try {
            yield _drive2.acquireLock(lockExpire);
            break;
          } catch (err) {
            if (err.name !== "LockError") {
              throw err;
            }
            lastErr = err;
          }
          tried++;
          if (tried >= retryMaxAttempts) {
            throw lastErr;
          }
          yield delay(wait * 1000);
          wait *= retryExp;
        }
        try {
          yield syncPull();
          yield syncPush();
        } finally {
          yield _drive2.releaseLock();
        }
      });
      return _sync.apply(this, arguments);
    }
    function syncNow(peek) {
      return lock.write(/*#__PURE__*/_asyncToGenerator(function* () {
        if (!state || !state.enabled) {
          throw new Error("Cannot sync now, the sync is not enabled");
        }
        if (_drive2.init && !_drive2.isInit) {
          yield _drive2.init();
          _drive2.isInit = true;
        }
        if (state.lastChange == null) {
          yield onFirstSync();
        }
        yield _syncNow(peek);
      }));
    }
    function _syncNow() {
      return _syncNow2.apply(this, arguments);
    }
    function _syncNow2() {
      _syncNow2 = _asyncToGenerator(function* (peek = true) {
        if (onProgress) {
          onProgress({
            phase: 'start'
          });
        }
        try {
          if (!state.queue.length && peek && meta) {
            var changed = yield _drive2.peekChanges(meta);
            if (!changed) {
              return;
            }
          }
          yield sync();
        } finally {
          if (onProgress) {
            onProgress({
              phase: 'end'
            });
          }
        }
      });
      return _syncNow2.apply(this, arguments);
    }
    function put(_id, _rev) {
      if (!state || !state.enabled) {
        return;
      }
      state.queue.push({
        _id,
        _rev,
        action: "put"
      });
      saveState();
    }
    function delete_(_id, _rev) {
      if (!state || !state.enabled) {
        return;
      }
      state.queue.push({
        _id,
        _rev,
        action: "delete"
      });
      saveState();
    }
  }

  var empty = () => {};

  function percentToByte(p) {
    return String.fromCharCode(parseInt(p.slice(1), 16));
  }
  function encode(str) {
    return btoa(encodeURIComponent(str).replace(/%[0-9A-F]{2}/g, percentToByte));
  }
  function byteToPercent(b) {
    return "%".concat("00".concat(b.charCodeAt(0).toString(16)).slice(-2));
  }
  function decode(str) {
    return decodeURIComponent(Array.from(atob(str), byteToPercent).join(""));
  }

  var _excluded$2 = ["path", "contentType", "headers", "format", "raw"];
  class RequestError extends Error {
    constructor(message, origin, code = origin && origin.status) {
      super(message);
      this.code = code;
      this.origin = origin;
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, RequestError);
      }
    }
  }
  function createRequest({
    fetch,
    cooldown = 0,
    getAccessToken,
    username,
    password
  }) {
    var lock = createLock();
    var basicAuth = username || password ? "Basic ".concat(encode("".concat(username, ":").concat(password))) : null;
    return args => {
      return lock.write(/*#__PURE__*/function () {
        var _ref = _asyncToGenerator(function* (done) {
          try {
            return yield doRequest(args);
          } finally {
            if (!cooldown || !args.method || args.method === "GET") {
              done();
            } else {
              setTimeout(done, cooldown);
            }
          }
        });
        return function (_x) {
          return _ref.apply(this, arguments);
        };
      }());
    };
    function doRequest(_x2) {
      return _doRequest.apply(this, arguments);
    }
    function _doRequest() {
      _doRequest = _asyncToGenerator(function* (_ref2) {
        var path = _ref2.path,
          contentType = _ref2.contentType,
          _headers = _ref2.headers,
          format = _ref2.format,
          _ref2$raw = _ref2.raw,
          raw = _ref2$raw === void 0 ? false : _ref2$raw,
          args = _objectWithoutProperties(_ref2, _excluded$2);
        var headers = {};
        if (getAccessToken) {
          headers["Authorization"] = "Bearer ".concat(yield getAccessToken());
        }
        if (basicAuth) {
          headers["Authorization"] = basicAuth;
        }
        if (contentType) {
          headers["Content-Type"] = contentType;
        }
        Object.assign(headers, _headers);
        while (true) {
          // eslint-disable-line no-constant-condition
          // console.log("req", path, args, headers);
          var res = yield fetch(path, _objectSpread2({
            headers
          }, args));
          // console.log("res", path, args, res.status, headers);
          if (!res.ok) {
            var retry = res.headers.get("Retry-After");
            if (retry) {
              var time = Number(retry);
              if (time) {
                yield delay(time * 1000);
                continue;
              }
            }
            var text = yield res.text();
            throw new RequestError("failed to fetch [".concat(res.status, "]: ").concat(text), res);
          }
          if (raw) {
            return res;
          }
          if (format) {
            return yield res[format]();
          }
          var resContentType = res.headers.get("Content-Type");
          if (/application\/json/.test(resContentType)) {
            return yield res.json();
          }
          return yield res.text();
        }
      });
      return _doRequest.apply(this, arguments);
    }
  }

  function createDrive$4({
    userAgent = "db-to-cloud",
    owner,
    repo,
    getAccessToken,
    fetch = (typeof self !== "undefined" ? self : global).fetch
  }) {
    var request = createRequest({
      fetch,
      getAccessToken,
      cooldown: 1000
    });
    var shaCache = new Map();
    return {
      name: "github",
      get,
      put,
      post,
      delete: delete_,
      list,
      shaCache
    };
    function requestAPI(args) {
      if (!args.headers) {
        args.headers = {};
      }
      if (!args.headers["User-Agent"]) {
        args.headers["User-Agent"] = userAgent;
      }
      if (!args.headers["Accept"]) {
        args.headers["Accept"] = "application/vnd.github.v3+json";
      }
      args.path = "https://api.github.com".concat(args.path);
      return request(args);
    }
    function list(_x) {
      return _list.apply(this, arguments);
    }
    function _list() {
      _list = _asyncToGenerator(function* (file) {
        // FIXME: This API has an upper limit of 1,000 files for a directory. If you need to retrieve more files, use the Git Trees API.
        var result = yield requestAPI({
          path: "/repos/".concat(owner, "/").concat(repo, "/contents/").concat(file)
        });
        var names = [];
        var _iterator = _createForOfIteratorHelper(result),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var item = _step.value;
            names.push(item.name);
            shaCache.set(item.path, item.sha);
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        return names;
      });
      return _list.apply(this, arguments);
    }
    function get(_x2) {
      return _get.apply(this, arguments);
    }
    function _get() {
      _get = _asyncToGenerator(function* (file) {
        // FIXME: This API supports files up to 1 megabyte in size.
        var result = yield requestAPI({
          path: "/repos/".concat(owner, "/").concat(repo, "/contents/").concat(file)
        });
        shaCache.set(result.path, result.sha);
        return decode(result.content);
      });
      return _get.apply(this, arguments);
    }
    function put(_x3, _x4) {
      return _put.apply(this, arguments);
    }
    function _put() {
      _put = _asyncToGenerator(function* (file, data, overwrite = true) {
        var params = {
          message: "",
          content: encode(data)
        };
        if (overwrite && shaCache.has(file)) {
          params.sha = shaCache.get(file);
        }
        var args = {
          method: "PUT",
          path: "/repos/".concat(owner, "/").concat(repo, "/contents/").concat(file),
          contentType: "application/json",
          body: JSON.stringify(params)
        };
        var retried = false;
        var result;
        while (!result) {
          try {
            result = yield requestAPI(args);
          } catch (err) {
            if (err.code !== 422 || !err.message.includes("\\\"sha\\\" wasn't supplied")) {
              throw err;
            }
            if (!overwrite || retried) {
              err.code = "EEXIST";
              throw err;
            }
            yield get(file);
          }
          retried = true;
        }
        shaCache.set(file, result.content.sha);
      });
      return _put.apply(this, arguments);
    }
    function post(file, data) {
      return put(file, data, false);
    }
    function delete_(_x5) {
      return _delete_.apply(this, arguments);
    }
    function _delete_() {
      _delete_ = _asyncToGenerator(function* (file) {
        try {
          var sha = shaCache.get(file);
          if (!sha) {
            yield get(file);
            sha = shaCache.get(file);
          }
          yield requestAPI({
            method: "DELETE",
            path: "/repos/".concat(owner, "/").concat(repo, "/contents/").concat(file),
            body: JSON.stringify({
              message: "",
              sha
            })
          });
        } catch (err) {
          if (err.code === 404) {
            return;
          }
          // FIXME: do we have to handle 422 errors?
          throw err;
        }
      });
      return _delete_.apply(this, arguments);
    }
  }

  var _excluded$1 = ["path", "body"];
  function createDrive$3({
    getAccessToken,
    fetch = (typeof self !== "undefined" ? self : global).fetch
  }) {
    var request = createRequest({
      fetch,
      getAccessToken
    });
    return {
      name: "dropbox",
      get,
      put,
      post,
      delete: delete_,
      list
    };
    function requestRPC(_ref) {
      var path = _ref.path,
        body = _ref.body,
        args = _objectWithoutProperties(_ref, _excluded$1);
      return request(_objectSpread2({
        method: "POST",
        path: "https://api.dropboxapi.com/2/".concat(path),
        contentType: "application/json",
        body: JSON.stringify(body)
      }, args));
    }
    function list(_x) {
      return _list.apply(this, arguments);
    }
    function _list() {
      _list = _asyncToGenerator(function* (file) {
        var names = [];
        var result = yield requestRPC({
          path: "files/list_folder",
          body: {
            path: "/".concat(file)
          }
        });
        var _iterator = _createForOfIteratorHelper(result.entries),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var _entry = _step.value;
            names.push(_entry.name);
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        if (!result.has_more) {
          return names;
        }
        while (result.has_more) {
          result = yield requestRPC({
            path: "files/list_folder/continue",
            body: {
              cursor: result.cursor
            }
          });
          var _iterator2 = _createForOfIteratorHelper(result.entries),
            _step2;
          try {
            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
              var entry = _step2.value;
              names.push(entry.name);
            }
          } catch (err) {
            _iterator2.e(err);
          } finally {
            _iterator2.f();
          }
        }
        return names;
      });
      return _list.apply(this, arguments);
    }
    function stringifyParams(obj) {
      var params = new URLSearchParams();
      params.set("arg", JSON.stringify(obj));
      return params.toString();
    }
    function get(_x2) {
      return _get.apply(this, arguments);
    }
    function _get() {
      _get = _asyncToGenerator(function* (file) {
        var params = {
          path: "/".concat(file)
        };
        try {
          return yield request({
            path: "https://content.dropboxapi.com/2/files/download?".concat(stringifyParams(params)),
            format: "text"
          });
        } catch (err) {
          if (err.code === 409 && err.message.includes("not_found")) {
            err.code = "ENOENT";
          }
          throw err;
        }
      });
      return _get.apply(this, arguments);
    }
    function put(_x3, _x4) {
      return _put.apply(this, arguments);
    }
    function _put() {
      _put = _asyncToGenerator(function* (file, data, mode = "overwrite") {
        var params = {
          path: "/".concat(file),
          mode,
          autorename: false,
          mute: true
        };
        yield request({
          path: "https://content.dropboxapi.com/2/files/upload?".concat(stringifyParams(params)),
          method: "POST",
          contentType: "application/octet-stream",
          body: data
        });
      });
      return _put.apply(this, arguments);
    }
    function post(_x5, _x6) {
      return _post.apply(this, arguments);
    }
    function _post() {
      _post = _asyncToGenerator(function* (file, data) {
        try {
          return yield put(file, data, "add");
        } catch (err) {
          if (err.code === 409 && err.message.includes("conflict")) {
            err.code = "EEXIST";
          }
          throw err;
        }
      });
      return _post.apply(this, arguments);
    }
    function delete_(_x7) {
      return _delete_.apply(this, arguments);
    }
    function _delete_() {
      _delete_ = _asyncToGenerator(function* (file) {
        try {
          yield requestRPC({
            path: "files/delete_v2",
            body: {
              path: "/".concat(file)
            }
          });
        } catch (err) {
          if (err.code === 409 && err.message.includes("not_found")) {
            return;
          }
          throw err;
        }
      });
      return _delete_.apply(this, arguments);
    }
  }

  function createDrive$2({
    getAccessToken,
    fetch = (typeof self !== "undefined" ? self : global).fetch
  }) {
    var request = createRequest({
      fetch,
      getAccessToken
    });
    return {
      name: "onedrive",
      get,
      put,
      post,
      delete: delete_,
      list
    };
    function query(_x) {
      return _query.apply(this, arguments);
    }
    function _query() {
      _query = _asyncToGenerator(function* (args) {
        args.path = "https://graph.microsoft.com/v1.0/me/drive/special/approot".concat(args.path);
        return yield request(args);
      });
      return _query.apply(this, arguments);
    }
    function list(_x2) {
      return _list.apply(this, arguments);
    }
    function _list() {
      _list = _asyncToGenerator(function* (file) {
        if (file) {
          file = ":/".concat(file, ":");
        }
        var result = yield query({
          path: "".concat(file, "/children?select=name")
        });
        var files = result.value.map(i => i.name);
        while (result["@odata.nextLink"]) {
          result = yield request({
            path: result["@odata.nextLink"]
          });
          files = files.concat(result.value.map(i => i.name));
        }
        return files;
      });
      return _list.apply(this, arguments);
    }
    function get(_x3) {
      return _get.apply(this, arguments);
    }
    function _get() {
      _get = _asyncToGenerator(function* (file) {
        return yield query({
          path: ":/".concat(file, ":/content"),
          format: "text"
        });
      });
      return _get.apply(this, arguments);
    }
    function put(_x4, _x5) {
      return _put.apply(this, arguments);
    }
    function _put() {
      _put = _asyncToGenerator(function* (file, data) {
        yield query({
          method: "PUT",
          path: ":/".concat(file, ":/content"),
          headers: {
            "Content-Type": "text/plain"
          },
          body: data
        });
      });
      return _put.apply(this, arguments);
    }
    function post(_x6, _x7) {
      return _post.apply(this, arguments);
    }
    function _post() {
      _post = _asyncToGenerator(function* (file, data) {
        try {
          yield query({
            method: "PUT",
            path: ":/".concat(file, ":/content?@microsoft.graph.conflictBehavior=fail"),
            headers: {
              "Content-Type": "text/plain"
            },
            body: data
          });
        } catch (err) {
          if (err.code === 409 && err.message.includes("nameAlreadyExists")) {
            err.code = "EEXIST";
          }
          throw err;
        }
      });
      return _post.apply(this, arguments);
    }
    function delete_(_x8) {
      return _delete_.apply(this, arguments);
    }
    function _delete_() {
      _delete_ = _asyncToGenerator(function* (file) {
        try {
          yield query({
            method: "DELETE",
            path: ":/".concat(file, ":")
          });
        } catch (err) {
          if (err.code === 404) {
            return;
          }
          throw err;
        }
      });
      return _delete_.apply(this, arguments);
    }
  }

  function createDrive$1({
    getAccessToken,
    fetch = (typeof self !== "undefined" ? self : global).fetch,
    FormData = (typeof self !== "undefined" ? self : global).FormData,
    Blob = (typeof self !== "undefined" ? self : global).Blob
  }) {
    var request = createRequest({
      fetch,
      getAccessToken
    });
    var fileMetaCache = new Map();
    var lockRev;
    return {
      name: "google",
      get,
      put,
      post,
      delete: delete_,
      list,
      init,
      acquireLock,
      releaseLock,
      fileMetaCache
    };
    function revDelete(_x, _x2) {
      return _revDelete.apply(this, arguments);
    }
    function _revDelete() {
      _revDelete = _asyncToGenerator(function* (fileId, revId) {
        yield request({
          method: "DELETE",
          path: "https://www.googleapis.com/drive/v3/files/".concat(fileId, "/revisions/").concat(revId)
        });
      });
      return _revDelete.apply(this, arguments);
    }
    function acquireLock(_x3) {
      return _acquireLock.apply(this, arguments);
    }
    function _acquireLock() {
      _acquireLock = _asyncToGenerator(function* (expire) {
        var lock = fileMetaCache.get("lock.json");
        // write the lock to the cloud
        var _yield$queryPatch = yield queryPatch(lock.id, JSON.stringify({
            expire: Date.now() + expire * 60 * 1000
          }), {
            keepRevisionForever: true
          }),
          headRevisionId = _yield$queryPatch.headRevisionId;
        try {
          var result = yield request({
            path: "https://www.googleapis.com/drive/v3/files/".concat(lock.id, "/revisions?fields=revisions(id)")
          });
          for (var i = 1; i < result.revisions.length; i++) {
            var revId = result.revisions[i].id;
            if (revId === headRevisionId) {
              // success
              lockRev = headRevisionId;
              return;
            }
            var rev = JSON.parse(yield request({
              path: "https://www.googleapis.com/drive/v3/files/".concat(lock.id, "/revisions/").concat(revId, "?alt=media")
            }));
            if (rev.expire > Date.now()) {
              // previous lock is still valid
              throw new LockError(rev.expire);
            }
            // delete outdated lock
            yield revDelete(lock.id, revId);
          }
          throw new Error("cannot find lock revision");
        } catch (err) {
          // cleanup
          yield revDelete(lock.id, headRevisionId);
          throw err;
        }
      });
      return _acquireLock.apply(this, arguments);
    }
    function releaseLock() {
      return _releaseLock.apply(this, arguments);
    }
    function _releaseLock() {
      _releaseLock = _asyncToGenerator(function* () {
        var lock = fileMetaCache.get("lock.json");
        yield revDelete(lock.id, lockRev);
        lockRev = null;
      });
      return _releaseLock.apply(this, arguments);
    }
    function queryList(_x4, _x5) {
      return _queryList.apply(this, arguments);
    }
    function _queryList() {
      _queryList = _asyncToGenerator(function* (path, onPage) {
        path = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name,headRevisionId)" + (path ? "&" + path : "");
        var result = yield request({
          path
        });
        onPage(result);
        while (result.nextPageToken) {
          result = yield request({
            path: "".concat(path, "&pageToken=").concat(result.nextPageToken)
          });
          onPage(result);
        }
      });
      return _queryList.apply(this, arguments);
    }
    function queryPatch(_x6, _x7, _x8) {
      return _queryPatch.apply(this, arguments);
    }
    function _queryPatch() {
      _queryPatch = _asyncToGenerator(function* (id, text, query) {
        var path = "https://www.googleapis.com/upload/drive/v3/files/".concat(id, "?uploadType=media&fields=headRevisionId");
        if (query) {
          path += "&".concat(new URLSearchParams(query).toString());
        }
        return yield request({
          method: "PATCH",
          path,
          headers: {
            "Content-Type": "text/plain"
          },
          body: text
        });
      });
      return _queryPatch.apply(this, arguments);
    }
    function updateMeta(_x9) {
      return _updateMeta.apply(this, arguments);
    }
    function _updateMeta() {
      _updateMeta = _asyncToGenerator(function* (query) {
        if (query) {
          query = "q=".concat(encodeURIComponent(query));
        }
        yield queryList(query, result => {
          var _iterator = _createForOfIteratorHelper(result.files),
            _step;
          try {
            for (_iterator.s(); !(_step = _iterator.n()).done;) {
              var file = _step.value;
              fileMetaCache.set(file.name, file);
            }
          } catch (err) {
            _iterator.e(err);
          } finally {
            _iterator.f();
          }
        });
      });
      return _updateMeta.apply(this, arguments);
    }
    function init() {
      return _init.apply(this, arguments);
    }
    function _init() {
      _init = _asyncToGenerator(function* () {
        yield updateMeta();
        if (!fileMetaCache.has("lock.json")) {
          yield post("lock.json", "{}");
        }
        if (!fileMetaCache.has("meta.json")) {
          yield post("meta.json", "{}");
        }
      });
      return _init.apply(this, arguments);
    }
    function list(_x0) {
      return _list.apply(this, arguments);
    }
    function _list() {
      _list = _asyncToGenerator(function* (file) {
        // FIXME: this only works if file is a single dir
        // FIXME: this only works if the list method is called right after init, use
        // queryList instead?
        return [...fileMetaCache.values()].filter(f => f.name.startsWith(file + "/")).map(f => f.name.split("/")[1]);
      });
      return _list.apply(this, arguments);
    }
    function get(_x1) {
      return _get.apply(this, arguments);
    }
    function _get() {
      _get = _asyncToGenerator(function* (file) {
        var meta = fileMetaCache.get(file);
        if (!meta) {
          yield updateMeta("name = '".concat(file, "'"));
          meta = fileMetaCache.get(file);
          if (!meta) {
            throw new RequestError("metaCache doesn't contain ".concat(file), null, "ENOENT");
          }
        }
        try {
          return yield request({
            path: "https://www.googleapis.com/drive/v3/files/".concat(meta.id, "?alt=media")
          });
        } catch (err) {
          if (err.code === 404) {
            err.code = "ENOENT";
          }
          throw err;
        }
      });
      return _get.apply(this, arguments);
    }
    function put(_x10, _x11) {
      return _put.apply(this, arguments);
    }
    function _put() {
      _put = _asyncToGenerator(function* (file, data) {
        if (!fileMetaCache.has(file)) {
          return yield post(file, data);
        }
        var meta = fileMetaCache.get(file);
        var result = yield queryPatch(meta.id, data);
        meta.headRevisionId = result.headRevisionId;
      });
      return _put.apply(this, arguments);
    }
    function post(_x12, _x13) {
      return _post.apply(this, arguments);
    }
    function _post() {
      _post = _asyncToGenerator(function* (file, data) {
        var body = new FormData();
        var meta = {
          name: file,
          parents: ["appDataFolder"]
        };
        body.append("metadata", new Blob([JSON.stringify(meta)], {
          type: "application/json; charset=UTF-8"
        }));
        body.append("media", new Blob([data], {
          type: "text/plain"
        }));
        var result = yield request({
          method: "POST",
          path: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,headRevisionId",
          body
        });
        fileMetaCache.set(result.name, result);
      });
      return _post.apply(this, arguments);
    }
    function delete_(_x14) {
      return _delete_.apply(this, arguments);
    }
    function _delete_() {
      _delete_ = _asyncToGenerator(function* (file) {
        var meta = fileMetaCache.get(file);
        if (!meta) {
          return;
        }
        try {
          yield request({
            method: "DELETE",
            path: "https://www.googleapis.com/drive/v3/files/".concat(meta.id)
          });
        } catch (err) {
          if (err.code === 404) {
            return;
          }
          throw err;
        }
      });
      return _delete_.apply(this, arguments);
    }
  }

  function dirname(path) {
    var dir = path.replace(/[/\\][^/\\]+\/?$/, "");
    if (dir === path) return ".";
    return dir;
  }
  function basename(path) {
    var match = path.match(/([^/\\]+)[/\\]*$/);
    return match ? match[1] : "";
  }

  var _excluded = ["path"];
  function arrayify(o) {
    return Array.isArray(o) ? o : [o];
  }
  function createDrive({
    username,
    password,
    url,
    fetch = (typeof self !== "undefined" ? self : global).fetch,
    DOMParser = (typeof self !== "undefined" ? self : global).DOMParser,
    parseXML = createXMLParser(DOMParser)
  }) {
    if (!url.endsWith("/")) {
      url += "/";
    }
    var request = createRequest({
      fetch,
      username,
      password
    });
    return {
      name: "webdav",
      get,
      put,
      post,
      delete: delete_,
      list
      // acquireLock,
      // releaseLock
    };
    function requestDAV(_x) {
      return _requestDAV.apply(this, arguments);
    }
    function _requestDAV() {
      _requestDAV = _asyncToGenerator(function* (_ref) {
        var path = _ref.path,
          args = _objectWithoutProperties(_ref, _excluded);
        var text = yield request(_objectSpread2({
          path: "".concat(url).concat(path)
        }, args));
        if (args.format || typeof text !== "string" || !text) return text;
        var result = yield parseXML(text);
        if (result.error) {
          throw new Error("Failed requesting DAV at ".concat(url).concat(path, ": ").concat(JSON.stringify(result.error)));
        }
        if (result.multistatus) {
          result.multistatus.response = arrayify(result.multistatus.response);
          var _iterator = _createForOfIteratorHelper(result.multistatus.response),
            _step;
          try {
            for (_iterator.s(); !(_step = _iterator.n()).done;) {
              var r = _step.value;
              if (r.error) {
                throw new Error("Failed requesting DAV at ".concat(url).concat(path, ": ").concat(r.href, " ").concat(r.error));
              }
            }
          } catch (err) {
            _iterator.e(err);
          } finally {
            _iterator.f();
          }
        }
        return result;
      });
      return _requestDAV.apply(this, arguments);
    }
    function list(_x2) {
      return _list.apply(this, arguments);
    }
    function _list() {
      _list = _asyncToGenerator(function* (file) {
        if (!file.endsWith("/")) {
          file += "/";
        }
        var result = yield requestDAV({
          method: "PROPFIND",
          path: file,
          contentType: "application/xml",
          body: "<?xml version=\"1.0\" encoding=\"utf-8\" ?> \n        <propfind xmlns=\"DAV:\">\n          <allprop/>\n        </propfind>",
          headers: {
            "Depth": "1"
          }
        });
        var files = [];
        var _iterator2 = _createForOfIteratorHelper(arrayify(result.multistatus.response)),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var entry = _step2.value;
            if (arrayify(entry.propstat).some(s => s.prop.resourcetype && s.prop.resourcetype.collection !== undefined)) {
              continue;
            }
            // FIXME: what is the proper way to get the filename from entry?
            // NOTE: some servers may treat `@` and `%40` as the same path, we may have to normalize them here and there.
            var base = "".concat(url).concat(file);
            var absUrl = new URL(entry.href, base).href;
            var name = basename(absUrl);
            files.push(name);
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
        return files;
      });
      return _list.apply(this, arguments);
    }
    function get(_x3) {
      return _get.apply(this, arguments);
    }
    function _get() {
      _get = _asyncToGenerator(function* (file) {
        return yield requestDAV({
          method: "GET",
          path: file,
          format: "text"
        });
      });
      return _get.apply(this, arguments);
    }
    function put(_x4, _x5) {
      return _put.apply(this, arguments);
    }
    function _put() {
      _put = _asyncToGenerator(function* (file, data) {
        return yield withDir(dirname(file), () => requestDAV({
          method: "PUT",
          path: file,
          contentType: "application/octet-stream",
          body: data
        }));
      });
      return _put.apply(this, arguments);
    }
    function withDir(_x6, _x7) {
      return _withDir.apply(this, arguments);
    }
    function _withDir() {
      _withDir = _asyncToGenerator(function* (dir, cb) {
        try {
          return yield cb();
        } catch (err) {
          if (err.code !== 409 && err.code !== 404 || dir === ".") {
            throw err;
          }
        }
        yield withDir(dirname(dir), () => requestDAV({
          method: "MKCOL",
          path: dir
        }));
        return yield cb();
      });
      return _withDir.apply(this, arguments);
    }
    function post(_x8, _x9) {
      return _post.apply(this, arguments);
    }
    function _post() {
      _post = _asyncToGenerator(function* (file, data) {
        try {
          return yield withDir(dirname(file), () => requestDAV({
            method: "PUT",
            path: file,
            body: data,
            contentType: "octet-stream",
            headers: {
              // FIXME: seems webdav-server doesn't support etag, what about others?
              "If-None-Match": "*"
            }
          }));
        } catch (err) {
          if (err.code === 412) {
            err.code = "EEXIST";
          }
          throw err;
        }
      });
      return _post.apply(this, arguments);
    }
    function delete_(_x0) {
      return _delete_.apply(this, arguments);
    } // async function acquireLock(mins) {
    // const r = await requestDAV({
    // method: "LOCK",
    // path: "",
    // body: 
    // `<?xml version="1.0" encoding="utf-8" ?> 
    // <lockinfo xmlns='DAV:'> 
    // <lockscope><exclusive/></lockscope> 
    // <locktype><write/></locktype> 
    // </lockinfo> `,
    // headers: {
    // "Timeout": `Second-${mins * 60}`
    // },
    // raw: true
    // });
    // lockToken = r.headers.get("Lock-Token");
    // }
    // async function releaseLock() {
    // await requestDAV({
    // method: "UNLOCK",
    // path: "",
    // headers: {
    // "Lock-Token": lockToken
    // }
    // });
    // }
    function _delete_() {
      _delete_ = _asyncToGenerator(function* (file) {
        // FIXME: support deleting collections?
        // FIXME: handle errors?
        try {
          yield requestDAV({
            method: "DELETE",
            path: file
          });
        } catch (err) {
          if (err.code === 404) return;
          throw err;
        }
      });
      return _delete_.apply(this, arguments);
    }
  }

  var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fsDrive: empty,
    github: createDrive$4,
    dropbox: createDrive$3,
    onedrive: createDrive$2,
    google: createDrive$1,
    webdav: createDrive
  });

  exports.dbToCloud = dbToCloud;
  exports.drive = index;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
//# sourceMappingURL=db-to-cloud.js.map
