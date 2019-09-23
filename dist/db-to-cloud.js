var dbToCloud = (function (exports) {
  'use strict';

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(source, true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(source).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  }

  function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};

    var target = _objectWithoutPropertiesLoose(source, excluded);

    var key, i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit(arr, i) {
    if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) {
      return;
    }

    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  }

  function createLock({
    maxActiveReader = Infinity
  } = {}) {
    let firstTask;
    let lastTask;
    let activeReader = 0;
    const self = {
      read: fn => que(fn, false),
      write: fn => que(fn, true),
      length: 0
    };
    return self;

    function que(fn, block) {
      const task = createTask({
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
      const o = {};
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
      const task = firstTask;

      if (!task || task.block && task.prev || task.prev && task.prev.block || activeReader >= maxActiveReader) {
        return;
      }

      if (!task.block) {
        activeReader++;
      }

      firstTask = task.next;
      let result;

      try {
        result = task.fn(task.q2 && task.q2.resolve);
      } catch (err) {
        task.q.reject(err); // auto release with sync error
        // q2 is useless in this case

        onDone();
        return;
      }

      if (task.q2) {
        task.q2.promise.then(_onDone);
      }

      if (result && result.then) {
        const pending = result.then(task.q.resolve, task.q.reject);

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

  var empty = (() => {});

  const _module_exports_ = {};
  Object.defineProperty(_module_exports_, "__esModule", {
    value: true
  });

  function percentToByte(p) {
    return String.fromCharCode(parseInt(p.slice(1), 16));
  }

  function encode(str) {
    return btoa(encodeURIComponent(str).replace(/%[0-9A-F]{2}/g, percentToByte));
  }

  _module_exports_.encode = encode;

  function byteToPercent(b) {
    return "%".concat("00".concat(b.charCodeAt(0).toString(16)).slice(-2));
  }

  function decode(str) {
    return decodeURIComponent(Array.from(atob(str), byteToPercent).join(""));
  }

  _module_exports_.decode = decode;

  class CustomError extends Error {
    constructor(code, origin, message = origin.message || "An error occured in db-to-cloud") {
      super(message);

      if (origin.name) {
        this.name = origin.name;
      }

      this.code = code;
      this.origin = origin;

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CustomError);
      }
    }

  }

  function createDrive({
    owner,
    repo,
    getAccessToken,
    getOctokit = () => {
      const _local_Octokit = Octokit;
      const throttlingPlugin = octokitPluginThrottling;
      return _local_Octokit.plugin(throttlingPlugin);
    }
  }) {
    let octokit;
    const shaCache = new Map();
    const api = {
      name: "github",
      init,
      get,
      put,
      post,
      delete: delete_,
      list,
      shaCache
    };

    for (var _i = 0, _Object$entries = Object.entries(api); _i < _Object$entries.length; _i++) {
      const _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
            key = _Object$entries$_i[0],
            fn = _Object$entries$_i[1];

      if (typeof fn !== "function") {
        continue;
      }

      api[key] =
      /*#__PURE__*/
      function () {
        var _ref = _asyncToGenerator(
        /*#__PURE__*/
        regeneratorRuntime.mark(function _callee(...args) {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) switch (_context.prev = _context.next) {
              case 0:
                _context.prev = 0;
                _context.next = 3;
                return fn(...args);

              case 3:
                return _context.abrupt("return", _context.sent);

              case 6:
                _context.prev = 6;
                _context.t0 = _context["catch"](0);

                if (!(_context.t0.status === 404)) {
                  _context.next = 10;
                  break;
                }

                throw new CustomError("ENOENT", _context.t0);

              case 10:
                throw _context.t0;

              case 11:
              case "end":
                return _context.stop();
            }
          }, _callee, null, [[0, 6]]);
        }));

        return function () {
          return _ref.apply(this, arguments);
        };
      }();
    }

    return api;

    function init() {
      return _init.apply(this, arguments);
    }

    function _init() {
      _init = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3() {
        var _local_Octokit;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return getOctokit();

            case 2:
              _local_Octokit = _context3.sent;
              _context3.t0 = _local_Octokit;
              _context3.t1 = {
                onAbuseLimit: (retryAfter, options) => {
                  console.warn("Abuse detected for request ".concat(options.method, " ").concat(options.url));
                  return false;
                },
                onRateLimit: (retryAfter, options) => {
                  console.warn("Request quota exhausted for request ".concat(options.method, " ").concat(options.url));
                  return false;
                }
              };
              _context3.t2 = {
                auth() {
                  return _asyncToGenerator(
                  /*#__PURE__*/
                  regeneratorRuntime.mark(function _callee2() {
                    return regeneratorRuntime.wrap(function _callee2$(_context2) {
                      while (1) switch (_context2.prev = _context2.next) {
                        case 0:
                          _context2.t0 = "token ";
                          _context2.next = 3;
                          return getAccessToken();

                        case 3:
                          _context2.t1 = _context2.sent;
                          return _context2.abrupt("return", _context2.t0.concat.call(_context2.t0, _context2.t1));

                        case 5:
                        case "end":
                          return _context2.stop();
                      }
                    }, _callee2);
                  }))();
                },

                throttle: _context3.t1
              };
              octokit = new _context3.t0(_context3.t2);

            case 7:
            case "end":
              return _context3.stop();
          }
        }, _callee3);
      }));
      return _init.apply(this, arguments);
    }

    function list(_x) {
      return _list.apply(this, arguments);
    }

    function _list() {
      _list = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(file) {
        var result, names, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return octokit.repos.getContents({
                owner,
                repo,
                path: file
              });

            case 2:
              result = _context4.sent;
              names = [];
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context4.prev = 7;

              for (_iterator = result.data[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                item = _step.value;
                names.push(item.name);
                shaCache.set(item.path, item.sha);
              }

              _context4.next = 15;
              break;

            case 11:
              _context4.prev = 11;
              _context4.t0 = _context4["catch"](7);
              _didIteratorError = true;
              _iteratorError = _context4.t0;

            case 15:
              _context4.prev = 15;
              _context4.prev = 16;

              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }

            case 18:
              _context4.prev = 18;

              if (!_didIteratorError) {
                _context4.next = 21;
                break;
              }

              throw _iteratorError;

            case 21:
              return _context4.finish(18);

            case 22:
              return _context4.finish(15);

            case 23:
              return _context4.abrupt("return", names);

            case 24:
            case "end":
              return _context4.stop();
          }
        }, _callee4, null, [[7, 11, 15, 23], [16,, 18, 22]]);
      }));
      return _list.apply(this, arguments);
    }

    function get(_x2) {
      return _get.apply(this, arguments);
    }

    function _get() {
      _get = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(file) {
        var result;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return octokit.repos.getContents({
                owner,
                repo,
                path: file
              });

            case 2:
              result = _context5.sent;
              shaCache.set(result.data.path, result.data.sha);
              return _context5.abrupt("return", _module_exports_.decode(result.data.content));

            case 5:
            case "end":
              return _context5.stop();
          }
        }, _callee5);
      }));
      return _get.apply(this, arguments);
    }

    function put(_x3, _x4) {
      return _put.apply(this, arguments);
    }

    function _put() {
      _put = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(file, data) {
        var options, result;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              options = {
                owner,
                repo,
                path: file,
                message: "",
                content: _module_exports_.encode(data)
              };

              if (shaCache.has(file)) {
                options.sha = shaCache.get(file);
              }

              _context6.prev = 2;
              _context6.next = 5;
              return octokit.repos.createOrUpdateFile(options);

            case 5:
              result = _context6.sent;
              _context6.next = 17;
              break;

            case 8:
              _context6.prev = 8;
              _context6.t0 = _context6["catch"](2);

              if (!(_context6.t0.status === 422 && !options.sha)) {
                _context6.next = 16;
                break;
              }

              _context6.next = 13;
              return get(file);

            case 13:
              _context6.next = 15;
              return put(file, data);

            case 15:
              return _context6.abrupt("return", _context6.sent);

            case 16:
              throw _context6.t0;

            case 17:
              shaCache.set(file, result.data.content.sha);

            case 18:
            case "end":
              return _context6.stop();
          }
        }, _callee6, null, [[2, 8]]);
      }));
      return _put.apply(this, arguments);
    }

    function post(_x5, _x6) {
      return _post.apply(this, arguments);
    }

    function _post() {
      _post = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee7(file, data) {
        var result;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              _context7.prev = 0;
              _context7.next = 3;
              return octokit.repos.createOrUpdateFile({
                owner,
                repo,
                path: file,
                message: "",
                content: _module_exports_.encode(data)
              });

            case 3:
              result = _context7.sent;
              _context7.next = 11;
              break;

            case 6:
              _context7.prev = 6;
              _context7.t0 = _context7["catch"](0);

              if (!(_context7.t0.status === 422)) {
                _context7.next = 10;
                break;
              }

              throw new CustomError("EEXIST", _context7.t0);

            case 10:
              throw _context7.t0;

            case 11:
              shaCache.set(file, result.data.content.sha);

            case 12:
            case "end":
              return _context7.stop();
          }
        }, _callee7, null, [[0, 6]]);
      }));
      return _post.apply(this, arguments);
    }

    function delete_(_x7) {
      return _delete_.apply(this, arguments);
    }

    function _delete_() {
      _delete_ = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee8(file) {
        var sha;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              sha = shaCache.has(file);

              if (sha) {
                _context8.next = 4;
                break;
              }

              _context8.next = 4;
              return get(file);

            case 4:
              _context8.prev = 4;
              _context8.next = 7;
              return octokit.repos.deleteFile({
                owner,
                repo,
                path: file,
                message: "",
                sha: shaCache.get(file)
              });

            case 7:
              _context8.next = 14;
              break;

            case 9:
              _context8.prev = 9;
              _context8.t0 = _context8["catch"](4);

              if (!(_context8.t0.status === 404)) {
                _context8.next = 13;
                break;
              }

              return _context8.abrupt("return");

            case 13:
              throw _context8.t0;

            case 14:
            case "end":
              return _context8.stop();
          }
        }, _callee8, null, [[4, 9]]);
      }));
      return _delete_.apply(this, arguments);
    }
  }

  function blobToText(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(new Error("Failed to convert blob object to text"));
      };

      reader.readAsText(blob);
    });
  }

  function testErrorSummary(err, text) {
    const error = err.error;

    if (typeof error === "string") {
      return error.includes(text);
    }

    return error.error_summary && error.error_summary.includes(text);
  }

  function createDrive$1({
    getAccessToken,
    clientId,
    fetch: _fetch = fetch,
    getDropbox = () => dropbox.Dropbox
  }) {
    let _local_dropbox;

    return {
      name: "dropbox",
      init,
      get,
      put,
      post,
      delete: delete_,
      list
    };

    function init() {
      return _init.apply(this, arguments);
    }

    function _init() {
      _init = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee() {
        var Dropbox;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return getDropbox();

            case 2:
              Dropbox = _context.sent;
              _local_dropbox = new Dropbox({
                fetch: _fetch,
                clientId
              });
              _context.t0 = _local_dropbox;
              _context.next = 7;
              return getAccessToken(_local_dropbox);

            case 7:
              _context.t1 = _context.sent;

              _context.t0.setAccessToken.call(_context.t0, _context.t1);

            case 9:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));
      return _init.apply(this, arguments);
    }

    function list(_x) {
      return _list.apply(this, arguments);
    }

    function _list() {
      _list = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(file) {
        var names, result, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, entry, cursor, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              names = [];
              _context2.next = 3;
              return _local_dropbox.filesListFolder({
                path: "/".concat(file)
              });

            case 3:
              result = _context2.sent;
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context2.prev = 7;

              for (_iterator = result.entries[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                entry = _step.value;
                names.push(entry.name);
              }

              _context2.next = 15;
              break;

            case 11:
              _context2.prev = 11;
              _context2.t0 = _context2["catch"](7);
              _didIteratorError = true;
              _iteratorError = _context2.t0;

            case 15:
              _context2.prev = 15;
              _context2.prev = 16;

              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }

            case 18:
              _context2.prev = 18;

              if (!_didIteratorError) {
                _context2.next = 21;
                break;
              }

              throw _iteratorError;

            case 21:
              return _context2.finish(18);

            case 22:
              return _context2.finish(15);

            case 23:
              if (result.has_more) {
                _context2.next = 25;
                break;
              }

              return _context2.abrupt("return", names);

            case 25:
              cursor = result.cursor;

            case 26:
              if (!result.has_more) {
                _context2.next = 52;
                break;
              }

              _context2.next = 29;
              return _local_dropbox.filesListFolderContinue({
                cursor
              });

            case 29:
              result = _context2.sent;
              cursor = result.cursor;
              _iteratorNormalCompletion2 = true;
              _didIteratorError2 = false;
              _iteratorError2 = undefined;
              _context2.prev = 34;

              for (_iterator2 = result.entries[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                entry = _step2.value;
                names.push(entry.name);
              }

              _context2.next = 42;
              break;

            case 38:
              _context2.prev = 38;
              _context2.t1 = _context2["catch"](34);
              _didIteratorError2 = true;
              _iteratorError2 = _context2.t1;

            case 42:
              _context2.prev = 42;
              _context2.prev = 43;

              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                _iterator2.return();
              }

            case 45:
              _context2.prev = 45;

              if (!_didIteratorError2) {
                _context2.next = 48;
                break;
              }

              throw _iteratorError2;

            case 48:
              return _context2.finish(45);

            case 49:
              return _context2.finish(42);

            case 50:
              _context2.next = 26;
              break;

            case 52:
              return _context2.abrupt("return", names);

            case 53:
            case "end":
              return _context2.stop();
          }
        }, _callee2, null, [[7, 11, 15, 23], [16,, 18, 22], [34, 38, 42, 50], [43,, 45, 49]]);
      }));
      return _list.apply(this, arguments);
    }

    function get(_x2) {
      return _get.apply(this, arguments);
    }

    function _get() {
      _get = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(file) {
        var result;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _context3.prev = 0;
              _context3.next = 3;
              return _local_dropbox.filesDownload({
                path: "/".concat(file)
              });

            case 3:
              result = _context3.sent;
              _context3.next = 11;
              break;

            case 6:
              _context3.prev = 6;
              _context3.t0 = _context3["catch"](0);

              if (!testErrorSummary(_context3.t0, "not_found")) {
                _context3.next = 10;
                break;
              }

              throw new CustomError("ENOENT", _context3.t0);

            case 10:
              throw _context3.t0;

            case 11:
              if (!result.fileBinary) {
                _context3.next = 13;
                break;
              }

              return _context3.abrupt("return", result.fileBinary.toString());

            case 13:
              _context3.next = 15;
              return blobToText(result.fileBlob);

            case 15:
              return _context3.abrupt("return", _context3.sent);

            case 16:
            case "end":
              return _context3.stop();
          }
        }, _callee3, null, [[0, 6]]);
      }));
      return _get.apply(this, arguments);
    }

    function put(_x3, _x4) {
      return _put.apply(this, arguments);
    }

    function _put() {
      _put = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(file, data) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return _local_dropbox.filesUpload({
                contents: data,
                path: "/".concat(file),
                mode: "overwrite",
                autorename: false
              });

            case 2:
            case "end":
              return _context4.stop();
          }
        }, _callee4);
      }));
      return _put.apply(this, arguments);
    }

    function post(_x5, _x6) {
      return _post.apply(this, arguments);
    }

    function _post() {
      _post = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(file, data) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              _context5.prev = 0;
              _context5.next = 3;
              return _local_dropbox.filesUpload({
                contents: data,
                path: "/".concat(file),
                mode: "add",
                autorename: false
              });

            case 3:
              _context5.next = 10;
              break;

            case 5:
              _context5.prev = 5;
              _context5.t0 = _context5["catch"](0);

              if (!testErrorSummary(_context5.t0, "conflict")) {
                _context5.next = 9;
                break;
              }

              throw new CustomError("EEXIST", _context5.t0);

            case 9:
              throw _context5.t0;

            case 10:
            case "end":
              return _context5.stop();
          }
        }, _callee5, null, [[0, 5]]);
      }));
      return _post.apply(this, arguments);
    }

    function delete_(_x7) {
      return _delete_.apply(this, arguments);
    }

    function _delete_() {
      _delete_ = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(file) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              _context6.prev = 0;
              _context6.next = 3;
              return _local_dropbox.filesDelete({
                path: "/".concat(file)
              });

            case 3:
              _context6.next = 10;
              break;

            case 5:
              _context6.prev = 5;
              _context6.t0 = _context6["catch"](0);

              if (!testErrorSummary(_context6.t0, "not_found")) {
                _context6.next = 9;
                break;
              }

              return _context6.abrupt("return");

            case 9:
              throw _context6.t0;

            case 10:
            case "end":
              return _context6.stop();
          }
        }, _callee6, null, [[0, 5]]);
      }));
      return _delete_.apply(this, arguments);
    }
  }

  function createDrive$2({
    getAccessToken,
    fetch: _fetch = fetch
  }) {
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
      _query = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(_ref) {
        var _ref$method, method, path, headers, _ref$format, format, args, res, _ref2, error;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              _ref$method = _ref.method, method = _ref$method === void 0 ? "GET" : _ref$method, path = _ref.path, headers = _ref.headers, _ref$format = _ref.format, format = _ref$format === void 0 ? "json" : _ref$format, args = _objectWithoutProperties(_ref, ["method", "path", "headers", "format"]);
              _context.t0 = _fetch;
              _context.t1 = "https://graph.microsoft.com/v1.0/me/drive/special/approot".concat(path);
              _context.t2 = _objectSpread2;
              _context.t3 = method;
              _context.t4 = _objectSpread2;
              _context.t5 = "bearer ";
              _context.next = 9;
              return getAccessToken();

            case 9:
              _context.t6 = _context.sent;
              _context.t7 = _context.t5.concat.call(_context.t5, _context.t6);
              _context.t8 = {
                "Authorization": _context.t7
              };
              _context.t9 = headers;
              _context.t10 = (0, _context.t4)(_context.t8, _context.t9);
              _context.t11 = {
                method: _context.t3,
                headers: _context.t10
              };
              _context.t12 = args;
              _context.t13 = (0, _context.t2)(_context.t11, _context.t12);
              _context.next = 19;
              return (0, _context.t0)(_context.t1, _context.t13);

            case 19:
              res = _context.sent;

              if (res.ok) {
                _context.next = 26;
                break;
              }

              _context.next = 23;
              return res.json();

            case 23:
              _ref2 = _context.sent;
              error = _ref2.error;
              throw new CustomError(error.code, error);

            case 26:
              if (!format) {
                _context.next = 30;
                break;
              }

              _context.next = 29;
              return res[format]();

            case 29:
              return _context.abrupt("return", _context.sent);

            case 30:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));
      return _query.apply(this, arguments);
    }

    function list(_x2) {
      return _list.apply(this, arguments);
    }

    function _list() {
      _list = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(file) {
        var result;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (file) {
                file = ":/".concat(file, ":");
              }

              _context2.next = 3;
              return query({
                path: "".concat(file, "/children?select=name")
              });

            case 3:
              result = _context2.sent;
              return _context2.abrupt("return", result.value.map(i => i.name));

            case 5:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      }));
      return _list.apply(this, arguments);
    }

    function get(_x3) {
      return _get.apply(this, arguments);
    }

    function _get() {
      _get = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(file) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _context3.prev = 0;
              _context3.next = 3;
              return query({
                path: ":/".concat(file, ":/content"),
                format: "text"
              });

            case 3:
              return _context3.abrupt("return", _context3.sent);

            case 6:
              _context3.prev = 6;
              _context3.t0 = _context3["catch"](0);

              if (_context3.t0.code === "itemNotFound") {
                _context3.t0.code = "ENOENT";
              }

              throw _context3.t0;

            case 10:
            case "end":
              return _context3.stop();
          }
        }, _callee3, null, [[0, 6]]);
      }));
      return _get.apply(this, arguments);
    }

    function put(_x4, _x5) {
      return _put.apply(this, arguments);
    }

    function _put() {
      _put = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(file, data) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return query({
                method: "PUT",
                path: ":/".concat(file, ":/content"),
                headers: {
                  "Content-Type": "text/plain"
                },
                body: data
              });

            case 2:
            case "end":
              return _context4.stop();
          }
        }, _callee4);
      }));
      return _put.apply(this, arguments);
    }

    function post(_x6, _x7) {
      return _post.apply(this, arguments);
    }

    function _post() {
      _post = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(file, data) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              _context5.prev = 0;
              _context5.next = 3;
              return query({
                method: "PUT",
                path: ":/".concat(file, ":/content?@microsoft.graph.conflictBehavior=fail"),
                headers: {
                  "Content-Type": "text/plain"
                },
                body: data
              });

            case 3:
              _context5.next = 9;
              break;

            case 5:
              _context5.prev = 5;
              _context5.t0 = _context5["catch"](0);

              if (_context5.t0.code === "nameAlreadyExists") {
                _context5.t0.code = "EEXIST";
              }

              throw _context5.t0;

            case 9:
            case "end":
              return _context5.stop();
          }
        }, _callee5, null, [[0, 5]]);
      }));
      return _post.apply(this, arguments);
    }

    function delete_(_x8) {
      return _delete_.apply(this, arguments);
    }

    function _delete_() {
      _delete_ = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(file) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              _context6.prev = 0;
              _context6.next = 3;
              return query({
                method: "DELETE",
                path: ":/".concat(file, ":"),
                format: null
              });

            case 3:
              _context6.next = 10;
              break;

            case 5:
              _context6.prev = 5;
              _context6.t0 = _context6["catch"](0);

              if (!(_context6.t0.code === "itemNotFound")) {
                _context6.next = 9;
                break;
              }

              return _context6.abrupt("return");

            case 9:
              throw _context6.t0;

            case 10:
            case "end":
              return _context6.stop();
          }
        }, _callee6, null, [[0, 5]]);
      }));
      return _delete_.apply(this, arguments);
    }
  }

  function createDrive$3({
    getAccessToken,

    /* eslint-disable no-undef */
    fetch: _fetch = fetch,
    FormData: _FormData = FormData,
    Blob: _Blob = Blob
    /* eslint-enable */

  }) {
    const fileMetaCache = new Map();
    let lockRev;
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
      _revDelete = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(fileId, revId) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return query({
                method: "DELETE",
                path: "https://www.googleapis.com/drive/v3/files/".concat(fileId, "/revisions/").concat(revId),
                format: null
              });

            case 2:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));
      return _revDelete.apply(this, arguments);
    }

    function acquireLock(_x3) {
      return _acquireLock.apply(this, arguments);
    }

    function _acquireLock() {
      _acquireLock = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(expire) {
        var lock, _ref, headRevisionId, result, i, revId, rev;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              lock = fileMetaCache.get("lock.json");
              _context2.next = 3;
              return queryPatch(lock.id, JSON.stringify({
                expire: Date.now() + expire * 60 * 1000
              }));

            case 3:
              _ref = _context2.sent;
              headRevisionId = _ref.headRevisionId;
              _context2.next = 7;
              return query({
                path: "https://www.googleapis.com/drive/v3/files/".concat(lock.id, "/revisions?fields=revisions(id)")
              });

            case 7:
              result = _context2.sent;
              i = 1;

            case 9:
              if (!(i < result.revisions.length)) {
                _context2.next = 26;
                break;
              }

              revId = result.revisions[i].id;

              if (!(revId === headRevisionId)) {
                _context2.next = 14;
                break;
              }

              // success
              lockRev = headRevisionId;
              return _context2.abrupt("return");

            case 14:
              _context2.next = 16;
              return query({
                path: "https://www.googleapis.com/drive/v3/files/".concat(lock.id, "/revisions/").concat(revId, "?alt=media")
              });

            case 16:
              rev = _context2.sent;

              if (!(rev.expire > Date.now())) {
                _context2.next = 21;
                break;
              }

              _context2.next = 20;
              return revDelete(lock.id, headRevisionId);

            case 20:
              throw new CustomError("EEXIST", new Error("failed to acquire lock"));

            case 21:
              _context2.next = 23;
              return revDelete(lock.id, revId);

            case 23:
              i++;
              _context2.next = 9;
              break;

            case 26:
              throw new Error("cannot find lock revision");

            case 27:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      }));
      return _acquireLock.apply(this, arguments);
    }

    function releaseLock() {
      return _releaseLock.apply(this, arguments);
    }

    function _releaseLock() {
      _releaseLock = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3() {
        var lock;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              lock = fileMetaCache.get("lock.json");
              _context3.next = 3;
              return revDelete(lock.id, lockRev);

            case 3:
              lockRev = null;

            case 4:
            case "end":
              return _context3.stop();
          }
        }, _callee3);
      }));
      return _releaseLock.apply(this, arguments);
    }

    function queryList(_x4, _x5) {
      return _queryList.apply(this, arguments);
    }

    function _queryList() {
      _queryList = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(path, onPage) {
        var result;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              path = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name,headRevisionId)" + (path ? "&" + path : "");
              _context4.next = 3;
              return query({
                path
              });

            case 3:
              result = _context4.sent;
              onPage(result);

            case 5:
              if (!result.nextPageToken) {
                _context4.next = 12;
                break;
              }

              _context4.next = 8;
              return query({
                path: "".concat(path, "&pageToken=").concat(result.nextPageToken)
              });

            case 8:
              result = _context4.sent;
              onPage(result);
              _context4.next = 5;
              break;

            case 12:
            case "end":
              return _context4.stop();
          }
        }, _callee4);
      }));
      return _queryList.apply(this, arguments);
    }

    function queryPatch(_x6, _x7) {
      return _queryPatch.apply(this, arguments);
    }

    function _queryPatch() {
      _queryPatch = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(id, text) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return query({
                method: "PATCH",
                path: "https://www.googleapis.com/upload/drive/v3/files/".concat(id, "?uploadType=media&fields=headRevisionId"),
                headers: {
                  "Content-Type": "text/plain"
                },
                body: text
              });

            case 2:
              return _context5.abrupt("return", _context5.sent);

            case 3:
            case "end":
              return _context5.stop();
          }
        }, _callee5);
      }));
      return _queryPatch.apply(this, arguments);
    }

    function updateMeta(_x8) {
      return _updateMeta.apply(this, arguments);
    }

    function _updateMeta() {
      _updateMeta = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(query) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              if (query) {
                query = "q=".concat(encodeURIComponent(query));
              }

              _context6.next = 3;
              return queryList(query, result => {
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                  for (var _iterator = result.files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    const file = _step.value;
                    fileMetaCache.set(file.name, file);
                  }
                } catch (err) {
                  _didIteratorError = true;
                  _iteratorError = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                      _iterator.return();
                    }
                  } finally {
                    if (_didIteratorError) {
                      throw _iteratorError;
                    }
                  }
                }
              });

            case 3:
            case "end":
              return _context6.stop();
          }
        }, _callee6);
      }));
      return _updateMeta.apply(this, arguments);
    }

    function init() {
      return _init.apply(this, arguments);
    }

    function _init() {
      _init = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              _context7.next = 2;
              return updateMeta();

            case 2:
              if (fileMetaCache.has("lock.json")) {
                _context7.next = 5;
                break;
              }

              _context7.next = 5;
              return post("lock.json", "{}");

            case 5:
              if (fileMetaCache.has("meta.json")) {
                _context7.next = 8;
                break;
              }

              _context7.next = 8;
              return post("meta.json", "{}");

            case 8:
            case "end":
              return _context7.stop();
          }
        }, _callee7);
      }));
      return _init.apply(this, arguments);
    }

    function query(_x9) {
      return _query.apply(this, arguments);
    }

    function _query() {
      _query = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee8(_ref2) {
        var _ref2$method, method, path, headers, _ref2$format, format, args, res, _ref3, error;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              _ref2$method = _ref2.method, method = _ref2$method === void 0 ? "GET" : _ref2$method, path = _ref2.path, headers = _ref2.headers, _ref2$format = _ref2.format, format = _ref2$format === void 0 ? "json" : _ref2$format, args = _objectWithoutProperties(_ref2, ["method", "path", "headers", "format"]);
              _context8.t0 = _fetch;
              _context8.t1 = path;
              _context8.t2 = _objectSpread2;
              _context8.t3 = method;
              _context8.t4 = _objectSpread2;
              _context8.t5 = "Bearer ";
              _context8.next = 9;
              return getAccessToken();

            case 9:
              _context8.t6 = _context8.sent;
              _context8.t7 = _context8.t5.concat.call(_context8.t5, _context8.t6);
              _context8.t8 = {
                "Authorization": _context8.t7
              };
              _context8.t9 = headers;
              _context8.t10 = (0, _context8.t4)(_context8.t8, _context8.t9);
              _context8.t11 = {
                method: _context8.t3,
                headers: _context8.t10
              };
              _context8.t12 = args;
              _context8.t13 = (0, _context8.t2)(_context8.t11, _context8.t12);
              _context8.next = 19;
              return (0, _context8.t0)(_context8.t1, _context8.t13);

            case 19:
              res = _context8.sent;

              if (res.ok) {
                _context8.next = 26;
                break;
              }

              _context8.next = 23;
              return res.json();

            case 23:
              _ref3 = _context8.sent;
              error = _ref3.error;
              throw new CustomError(error.code, error);

            case 26:
              if (!format) {
                _context8.next = 30;
                break;
              }

              _context8.next = 29;
              return res[format]();

            case 29:
              return _context8.abrupt("return", _context8.sent);

            case 30:
            case "end":
              return _context8.stop();
          }
        }, _callee8);
      }));
      return _query.apply(this, arguments);
    }

    function list(_x10) {
      return _list.apply(this, arguments);
    }

    function _list() {
      _list = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee9(file) {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              return _context9.abrupt("return", [...fileMetaCache.values()].filter(f => f.name.startsWith(file + "/")).map(f => f.name.split("/")[1]));

            case 1:
            case "end":
              return _context9.stop();
          }
        }, _callee9);
      }));
      return _list.apply(this, arguments);
    }

    function get(_x11) {
      return _get.apply(this, arguments);
    }

    function _get() {
      _get = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee10(file) {
        var meta;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) switch (_context10.prev = _context10.next) {
            case 0:
              meta = fileMetaCache.get(file);

              if (meta) {
                _context10.next = 7;
                break;
              }

              _context10.next = 4;
              return updateMeta("name = '".concat(file, "'"));

            case 4:
              meta = fileMetaCache.get(file);

              if (meta) {
                _context10.next = 7;
                break;
              }

              throw new CustomError("ENOENT", new Error("metaCache doesn't contain ".concat(file)));

            case 7:
              _context10.prev = 7;
              _context10.next = 10;
              return query({
                path: "https://www.googleapis.com/drive/v3/files/".concat(meta.id, "?alt=media"),
                format: "text"
              });

            case 10:
              return _context10.abrupt("return", _context10.sent);

            case 13:
              _context10.prev = 13;
              _context10.t0 = _context10["catch"](7);

              if (_context10.t0.code === 404) {
                _context10.t0.code = "ENOENT";
              }

              throw _context10.t0;

            case 17:
            case "end":
              return _context10.stop();
          }
        }, _callee10, null, [[7, 13]]);
      }));
      return _get.apply(this, arguments);
    }

    function put(_x12, _x13) {
      return _put.apply(this, arguments);
    }

    function _put() {
      _put = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee11(file, data) {
        var meta, result;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
              if (fileMetaCache.has(file)) {
                _context11.next = 4;
                break;
              }

              _context11.next = 3;
              return post(file, data);

            case 3:
              return _context11.abrupt("return", _context11.sent);

            case 4:
              meta = fileMetaCache.get(file);
              _context11.next = 7;
              return queryPatch(meta.id, data);

            case 7:
              result = _context11.sent;
              meta.headRevisionId = result.headRevisionId;

            case 9:
            case "end":
              return _context11.stop();
          }
        }, _callee11);
      }));
      return _put.apply(this, arguments);
    }

    function post(_x14, _x15) {
      return _post.apply(this, arguments);
    }

    function _post() {
      _post = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee12(file, data) {
        var body, meta, result;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) switch (_context12.prev = _context12.next) {
            case 0:
              body = new _FormData();
              meta = {
                name: file,
                parents: ["appDataFolder"]
              };
              body.append("metadata", new _Blob([JSON.stringify(meta)], {
                type: "application/json; charset=UTF-8"
              }));
              body.append("media", new _Blob([data], {
                type: "text/plain"
              }));
              _context12.next = 6;
              return query({
                method: "POST",
                path: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,headRevisionId",
                body
              });

            case 6:
              result = _context12.sent;
              fileMetaCache.set(result.name, result);

            case 8:
            case "end":
              return _context12.stop();
          }
        }, _callee12);
      }));
      return _post.apply(this, arguments);
    }

    function delete_(_x16) {
      return _delete_.apply(this, arguments);
    }

    function _delete_() {
      _delete_ = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee13(file) {
        var meta;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) switch (_context13.prev = _context13.next) {
            case 0:
              meta = fileMetaCache.get(file);

              if (meta) {
                _context13.next = 3;
                break;
              }

              return _context13.abrupt("return");

            case 3:
              _context13.prev = 3;
              _context13.next = 6;
              return query({
                method: "DELETE",
                path: "https://www.googleapis.com/drive/v3/files/".concat(meta.id),
                format: null
              });

            case 6:
              _context13.next = 13;
              break;

            case 8:
              _context13.prev = 8;
              _context13.t0 = _context13["catch"](3);

              if (!(_context13.t0.code === 404)) {
                _context13.next = 12;
                break;
              }

              return _context13.abrupt("return");

            case 12:
              throw _context13.t0;

            case 13:
            case "end":
              return _context13.stop();
          }
        }, _callee13, null, [[3, 8]]);
      }));
      return _delete_.apply(this, arguments);
    }
  }



  var index = /*#__PURE__*/Object.freeze({
    fsDrive: empty,
    github: createDrive,
    dropbox: createDrive$1,
    onedrive: createDrive$2,
    google: createDrive$3
  });

  function debounced(fn) {
    let timer = 0;
    let q;
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
      const o = {};
      o.promise = new Promise((resolve, reject) => {
        o.resolve = resolve;
        o.reject = reject;
      });
      return o;
    }
  }

  function buildDrive(_drive) {
    const drive = Object.create(_drive);

    drive.get =
    /*#__PURE__*/
    function () {
      var _ref = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(path) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              _context.t0 = JSON;
              _context.next = 3;
              return _drive.get(path);

            case 3:
              _context.t1 = _context.sent;
              return _context.abrupt("return", _context.t0.parse.call(_context.t0, _context.t1));

            case 5:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));

      return function (_x) {
        return _ref.apply(this, arguments);
      };
    }();

    drive.put =
    /*#__PURE__*/
    function () {
      var _ref2 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(path, data) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return _drive.put(path, JSON.stringify(data));

            case 2:
              return _context2.abrupt("return", _context2.sent);

            case 3:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      }));

      return function (_x2, _x3) {
        return _ref2.apply(this, arguments);
      };
    }();

    drive.post =
    /*#__PURE__*/
    function () {
      var _ref3 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(path, data) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return _drive.post(path, JSON.stringify(data));

            case 2:
              return _context3.abrupt("return", _context3.sent);

            case 3:
            case "end":
              return _context3.stop();
          }
        }, _callee3);
      }));

      return function (_x4, _x5) {
        return _ref3.apply(this, arguments);
      };
    }();

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
      _acquireLock = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(expire) {
        var data;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              _context4.prev = 0;
              _context4.next = 3;
              return this.post("lock.json", {
                expire: Date.now() + expire * 60 * 1000
              });

            case 3:
              _context4.next = 15;
              break;

            case 5:
              _context4.prev = 5;
              _context4.t0 = _context4["catch"](0);

              if (!(_context4.t0.code === "EEXIST")) {
                _context4.next = 14;
                break;
              }

              _context4.next = 10;
              return this.get("lock.json");

            case 10:
              data = _context4.sent;

              if (!(Date.now() > data.expire)) {
                _context4.next = 14;
                break;
              }

              _context4.next = 14;
              return this.delete("lock.json");

            case 14:
              throw _context4.t0;

            case 15:
            case "end":
              return _context4.stop();
          }
        }, _callee4, this, [[0, 5]]);
      }));
      return _acquireLock.apply(this, arguments);
    }

    function releaseLock() {
      return _releaseLock.apply(this, arguments);
    }

    function _releaseLock() {
      _releaseLock = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return this.delete("lock.json");

            case 2:
            case "end":
              return _context5.stop();
          }
        }, _callee5, this);
      }));
      return _releaseLock.apply(this, arguments);
    }

    function getMeta() {
      return _getMeta.apply(this, arguments);
    }

    function _getMeta() {
      _getMeta = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6() {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              _context6.prev = 0;
              _context6.next = 3;
              return this.get("meta.json");

            case 3:
              return _context6.abrupt("return", _context6.sent);

            case 6:
              _context6.prev = 6;
              _context6.t0 = _context6["catch"](0);

              if (!(_context6.t0.code === "ENOENT")) {
                _context6.next = 10;
                break;
              }

              return _context6.abrupt("return", {});

            case 10:
              throw _context6.t0;

            case 11:
            case "end":
              return _context6.stop();
          }
        }, _callee6, this, [[0, 6]]);
      }));
      return _getMeta.apply(this, arguments);
    }

    function putMeta(_x7) {
      return _putMeta.apply(this, arguments);
    }

    function _putMeta() {
      _putMeta = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee7(data) {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              _context7.next = 2;
              return this.put("meta.json", data);

            case 2:
            case "end":
              return _context7.stop();
          }
        }, _callee7, this);
      }));
      return _putMeta.apply(this, arguments);
    }

    function peekChanges(_x8) {
      return _peekChanges.apply(this, arguments);
    }

    function _peekChanges() {
      _peekChanges = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee8(oldMeta) {
        var newMeta;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              _context8.next = 2;
              return this.getMeta();

            case 2:
              newMeta = _context8.sent;
              return _context8.abrupt("return", newMeta.lastChange !== oldMeta.lastChange);

            case 4:
            case "end":
              return _context8.stop();
          }
        }, _callee8, this);
      }));
      return _peekChanges.apply(this, arguments);
    }
  }

  function dbToCloud({
    onGet,
    onPut,
    onDelete,
    onFirstSync,
    onWarn = console.error,
    compareRevision,
    getState,
    setState,
    lockExpire = 60
  }) {
    let _drive2;

    let state;
    let meta;
    const changeCache = new Map();
    const saveState = debounced(() => setState(_drive2, state));
    const revisionCache = new Map();
    const lock = createLock();
    return {
      use,
      start,
      stop,
      put,
      delete: delete_,
      syncNow,
      drive: () => _drive2
    };

    function use(newDrive) {
      _drive2 = buildDrive(newDrive);
    }

    function start() {
      return _start.apply(this, arguments);
    }

    function _start() {
      _start = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee9() {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              if (_drive2) {
                _context9.next = 2;
                break;
              }

              throw new Error("cloud drive is undefined");

            case 2:
              if (!_drive2.init) {
                _context9.next = 5;
                break;
              }

              _context9.next = 5;
              return _drive2.init();

            case 5:
              _context9.next = 7;
              return getState(_drive2);

            case 7:
              _context9.t0 = _context9.sent;

              if (_context9.t0) {
                _context9.next = 10;
                break;
              }

              _context9.t0 = {};

            case 10:
              state = _context9.t0;
              state.enabled = true;

              if (!state.queue) {
                state.queue = [];
              }

              if (!(state.lastChange == null)) {
                _context9.next = 16;
                break;
              }

              _context9.next = 16;
              return onFirstSync();

            case 16:
              _context9.next = 18;
              return syncNow();

            case 18:
            case "end":
              return _context9.stop();
          }
        }, _callee9);
      }));
      return _start.apply(this, arguments);
    }

    function stop() {
      return _stop.apply(this, arguments);
    }

    function _stop() {
      _stop = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee11() {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
              state.enabled = false;
              _context11.next = 3;
              return lock.write(
              /*#__PURE__*/
              _asyncToGenerator(
              /*#__PURE__*/
              regeneratorRuntime.mark(function _callee10() {
                return regeneratorRuntime.wrap(function _callee10$(_context10) {
                  while (1) switch (_context10.prev = _context10.next) {
                    case 0:
                      if (!_drive2.uninit) {
                        _context10.next = 3;
                        break;
                      }

                      _context10.next = 3;
                      return _drive2.uninit();

                    case 3:
                      _context10.next = 5;
                      return saveState();

                    case 5:
                    case "end":
                      return _context10.stop();
                  }
                }, _callee10);
              })));

            case 3:
            case "end":
              return _context11.stop();
          }
        }, _callee11);
      }));
      return _stop.apply(this, arguments);
    }

    function syncPull() {
      return _syncPull.apply(this, arguments);
    }

    function _syncPull() {
      _syncPull = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee12() {
        var changes, end, i, newChanges, idx, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, change, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _step2$value, id, doc;

        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) switch (_context12.prev = _context12.next) {
            case 0:
              _context12.next = 2;
              return _drive2.getMeta();

            case 2:
              meta = _context12.sent;

              if (!(!meta.lastChange || meta.lastChange === state.lastChange)) {
                _context12.next = 5;
                break;
              }

              return _context12.abrupt("return");

            case 5:
              changes = [];

              if (state.lastChange) {
                _context12.next = 13;
                break;
              }

              _context12.next = 9;
              return _drive2.list("docs");

            case 9:
              _context12.t0 = name => ({
                action: 'put',
                _id: name.slice(0, -5)
              });

              changes = _context12.sent.map(_context12.t0);
              _context12.next = 25;
              break;

            case 13:
              end = Math.floor((meta.lastChange - 1) / 100); // inclusive end

              i = Math.floor(state.lastChange / 100);

            case 15:
              if (!(i <= end)) {
                _context12.next = 24;
                break;
              }

              _context12.next = 18;
              return _drive2.get("changes/".concat(i, ".json"));

            case 18:
              newChanges = _context12.sent;
              changeCache.set(i, newChanges);
              changes = changes.concat(newChanges);
              i++;
              _context12.next = 15;
              break;

            case 24:
              changes = changes.slice(state.lastChange % 100);

            case 25:
              // merge changes
              idx = new Map();
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context12.prev = 29;

              for (_iterator = changes[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                change = _step.value;
                idx.set(change._id, change);
              }

              _context12.next = 37;
              break;

            case 33:
              _context12.prev = 33;
              _context12.t1 = _context12["catch"](29);
              _didIteratorError = true;
              _iteratorError = _context12.t1;

            case 37:
              _context12.prev = 37;
              _context12.prev = 38;

              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }

            case 40:
              _context12.prev = 40;

              if (!_didIteratorError) {
                _context12.next = 43;
                break;
              }

              throw _iteratorError;

            case 43:
              return _context12.finish(40);

            case 44:
              return _context12.finish(37);

            case 45:
              _iteratorNormalCompletion2 = true;
              _didIteratorError2 = false;
              _iteratorError2 = undefined;
              _context12.prev = 48;
              _iterator2 = idx[Symbol.iterator]();

            case 50:
              if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                _context12.next = 76;
                break;
              }

              _step2$value = _slicedToArray(_step2.value, 2), id = _step2$value[0], change = _step2$value[1];

              if (!(change.action === "delete")) {
                _context12.next = 57;
                break;
              }

              _context12.next = 55;
              return onDelete(id, change._rev);

            case 55:
              _context12.next = 72;
              break;

            case 57:
              if (!(change.action === "put")) {
                _context12.next = 72;
                break;
              }

              _context12.prev = 58;
              _context12.next = 61;
              return _drive2.get("docs/".concat(id, ".json"));

            case 61:
              doc = _context12.sent;
              _context12.next = 70;
              break;

            case 64:
              _context12.prev = 64;
              _context12.t2 = _context12["catch"](58);

              if (!(_context12.t2.code === "ENOENT")) {
                _context12.next = 69;
                break;
              }

              onWarn("Cannot find ".concat(id, ". Is it deleted without updating the history?"));
              return _context12.abrupt("continue", 73);

            case 69:
              throw _context12.t2;

            case 70:
              _context12.next = 72;
              return onPut(doc);

            case 72:
              // record the remote revision
              if (change._rev) {
                revisionCache.set(id, change._rev);
              }

            case 73:
              _iteratorNormalCompletion2 = true;
              _context12.next = 50;
              break;

            case 76:
              _context12.next = 82;
              break;

            case 78:
              _context12.prev = 78;
              _context12.t3 = _context12["catch"](48);
              _didIteratorError2 = true;
              _iteratorError2 = _context12.t3;

            case 82:
              _context12.prev = 82;
              _context12.prev = 83;

              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                _iterator2.return();
              }

            case 85:
              _context12.prev = 85;

              if (!_didIteratorError2) {
                _context12.next = 88;
                break;
              }

              throw _iteratorError2;

            case 88:
              return _context12.finish(85);

            case 89:
              return _context12.finish(82);

            case 90:
              state.lastChange = meta.lastChange;
              _context12.next = 93;
              return saveState();

            case 93:
            case "end":
              return _context12.stop();
          }
        }, _callee12, null, [[29, 33, 37, 45], [38,, 40, 44], [48, 78, 82, 90], [58, 64], [83,, 85, 89]]);
      }));
      return _syncPull.apply(this, arguments);
    }

    function syncPush() {
      return _syncPush.apply(this, arguments);
    }

    function _syncPush() {
      _syncPush = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee13() {
        var changes, idx, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, change, newChanges, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _step4$value, id, remoteRev, lastChanges, index, len, i, window;

        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) switch (_context13.prev = _context13.next) {
            case 0:
              if (state.queue.length) {
                _context13.next = 2;
                break;
              }

              return _context13.abrupt("return");

            case 2:
              // snapshot
              changes = state.queue.slice(); // merge changes

              idx = new Map();
              _iteratorNormalCompletion3 = true;
              _didIteratorError3 = false;
              _iteratorError3 = undefined;
              _context13.prev = 7;

              for (_iterator3 = changes[Symbol.iterator](); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                change = _step3.value;
                idx.set(change._id, change);
              }

              _context13.next = 15;
              break;

            case 11:
              _context13.prev = 11;
              _context13.t0 = _context13["catch"](7);
              _didIteratorError3 = true;
              _iteratorError3 = _context13.t0;

            case 15:
              _context13.prev = 15;
              _context13.prev = 16;

              if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                _iterator3.return();
              }

            case 18:
              _context13.prev = 18;

              if (!_didIteratorError3) {
                _context13.next = 21;
                break;
              }

              throw _iteratorError3;

            case 21:
              return _context13.finish(18);

            case 22:
              return _context13.finish(15);

            case 23:
              newChanges = [];
              _iteratorNormalCompletion4 = true;
              _didIteratorError4 = false;
              _iteratorError4 = undefined;
              _context13.prev = 27;
              _iterator4 = idx.entries()[Symbol.iterator]();

            case 29:
              if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                _context13.next = 52;
                break;
              }

              _step4$value = _slicedToArray(_step4.value, 2), id = _step4$value[0], change = _step4$value[1];
              // FIXME: is it safe to assume that the local doc is newer when
              // remoteRev is undefined?
              remoteRev = revisionCache.get(change._id);

              if (!(remoteRev !== undefined && compareRevision(change._rev, remoteRev) <= 0)) {
                _context13.next = 34;
                break;
              }

              return _context13.abrupt("continue", 49);

            case 34:
              if (!(change.action === "delete")) {
                _context13.next = 39;
                break;
              }

              _context13.next = 37;
              return _drive2.delete("docs/".concat(id, ".json"));

            case 37:
              _context13.next = 47;
              break;

            case 39:
              if (!(change.action === "put")) {
                _context13.next = 47;
                break;
              }

              _context13.t1 = _drive2;
              _context13.t2 = "docs/".concat(id, ".json");
              _context13.next = 44;
              return onGet(id, change._rev);

            case 44:
              _context13.t3 = _context13.sent;
              _context13.next = 47;
              return _context13.t1.put.call(_context13.t1, _context13.t2, _context13.t3);

            case 47:
              revisionCache.set(id, change._rev);
              newChanges.push(change);

            case 49:
              _iteratorNormalCompletion4 = true;
              _context13.next = 29;
              break;

            case 52:
              _context13.next = 58;
              break;

            case 54:
              _context13.prev = 54;
              _context13.t4 = _context13["catch"](27);
              _didIteratorError4 = true;
              _iteratorError4 = _context13.t4;

            case 58:
              _context13.prev = 58;
              _context13.prev = 59;

              if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                _iterator4.return();
              }

            case 61:
              _context13.prev = 61;

              if (!_didIteratorError4) {
                _context13.next = 64;
                break;
              }

              throw _iteratorError4;

            case 64:
              return _context13.finish(61);

            case 65:
              return _context13.finish(58);

            case 66:
              if (!meta.lastChange) {
                _context13.next = 83;
                break;
              }

              index = Math.floor(meta.lastChange / 100);
              len = meta.lastChange % 100;

              if (!len) {
                _context13.next = 78;
                break;
              }

              _context13.t6 = changeCache.get(index);

              if (_context13.t6) {
                _context13.next = 75;
                break;
              }

              _context13.next = 74;
              return _drive2.get("changes/".concat(index, ".json"));

            case 74:
              _context13.t6 = _context13.sent;

            case 75:
              _context13.t5 = _context13.t6;
              _context13.next = 79;
              break;

            case 78:
              _context13.t5 = [];

            case 79:
              lastChanges = _context13.t5;
              // it is possible that JSON data contains more records defined by
              // meta.lastChange
              lastChanges = lastChanges.slice(0, len).concat(newChanges);
              _context13.next = 85;
              break;

            case 83:
              // first sync
              index = 0;
              lastChanges = newChanges;

            case 85:
              i = 0;

            case 86:
              if (!(i * 100 < lastChanges.length)) {
                _context13.next = 94;
                break;
              }

              window = lastChanges.slice(i * 100, (i + 1) * 100);
              _context13.next = 90;
              return _drive2.put("changes/".concat(index + i, ".json"), window);

            case 90:
              changeCache.set(index + i, window);

            case 91:
              i++;
              _context13.next = 86;
              break;

            case 94:
              meta.lastChange = (meta.lastChange || 0) + newChanges.length;
              _context13.next = 97;
              return _drive2.putMeta(meta);

            case 97:
              state.queue = state.queue.slice(changes.length);
              state.lastChange = meta.lastChange;
              _context13.next = 101;
              return saveState();

            case 101:
            case "end":
              return _context13.stop();
          }
        }, _callee13, null, [[7, 11, 15, 23], [16,, 18, 22], [27, 54, 58, 66], [59,, 61, 65]]);
      }));
      return _syncPush.apply(this, arguments);
    }

    function sync() {
      return _sync.apply(this, arguments);
    }

    function _sync() {
      _sync = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee14() {
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) switch (_context14.prev = _context14.next) {
            case 0:
              _context14.next = 2;
              return _drive2.acquireLock(lockExpire);

            case 2:
              _context14.prev = 2;
              _context14.next = 5;
              return syncPull();

            case 5:
              _context14.next = 7;
              return syncPush();

            case 7:
              _context14.prev = 7;
              _context14.next = 10;
              return _drive2.releaseLock();

            case 10:
              return _context14.finish(7);

            case 11:
            case "end":
              return _context14.stop();
          }
        }, _callee14, null, [[2,, 7, 11]]);
      }));
      return _sync.apply(this, arguments);
    }

    function syncNow() {
      return _syncNow.apply(this, arguments);
    }

    function _syncNow() {
      _syncNow = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee16(peek = true) {
        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) switch (_context16.prev = _context16.next) {
            case 0:
              if (state.enabled) {
                _context16.next = 2;
                break;
              }

              throw new Error("Cannot sync now, the sync is not enabled");

            case 2:
              _context16.next = 4;
              return lock.write(
              /*#__PURE__*/
              _asyncToGenerator(
              /*#__PURE__*/
              regeneratorRuntime.mark(function _callee15() {
                var changed;
                return regeneratorRuntime.wrap(function _callee15$(_context15) {
                  while (1) switch (_context15.prev = _context15.next) {
                    case 0:
                      if (!(!state.queue.length && peek && meta)) {
                        _context15.next = 6;
                        break;
                      }

                      _context15.next = 3;
                      return _drive2.peekChanges(meta);

                    case 3:
                      changed = _context15.sent;

                      if (changed) {
                        _context15.next = 6;
                        break;
                      }

                      return _context15.abrupt("return");

                    case 6:
                      _context15.next = 8;
                      return sync();

                    case 8:
                    case "end":
                      return _context15.stop();
                  }
                }, _callee15);
              })));

            case 4:
            case "end":
              return _context16.stop();
          }
        }, _callee16);
      }));
      return _syncNow.apply(this, arguments);
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

  exports.dbToCloud = dbToCloud;
  exports.drive = index;

  return exports;

}({}));
