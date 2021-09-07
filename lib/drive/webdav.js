/* global self */
const {dirname} = require("path");

const {createRequest} = require("../request");

function arrayify(o) {
  return Array.isArray(o) ? o : [o];
}

function xmlToJSON(node) {
  // FIXME: xmldom doesn't support children
  const children = Array.prototype.filter.call(node.childNodes, i => i.nodeType === 1);
  if (!children.length) {
    return node.textContent;
  }
  
  const o = {};
  for (const c of children) {
    const cResult = xmlToJSON(c);
    if (!o[c.localName]) {
      o[c.localName] = cResult;
    } else if (!Array.isArray(o[c.localName])) {
      const list = [o[c.localName]];
      list.push(cResult);
      o[c.localName] = list;
    } else {
      o[c.localName].push(cResult);
    }
  }
  return o;
}

function createDrive({
  username,
  password,
  url,
  fetch = (typeof self !== "undefined" ? self : global).fetch,
  DOMParser = (typeof self !== "undefined" ? self : global).DOMParser,
}) {
  if (!url.endsWith("/")) {
    url += "/";
  }
  let lockToken;
  const request = createRequest({fetch, username, password});
  return {
    name: "webdav",
    get,
    put,
    post,
    delete: delete_,
    list,
    // acquireLock,
    // releaseLock
  };
  
  async function requestDAV({path, ...args}) {
    if (lockToken) {
      args.headers = args.headers || {};
      args.headers["If"] = `(${lockToken})`;
    }
    const text = await request({
      path: `${url}${path}`,
      ...args
    });
    if (args.format || typeof text !== "string" || !text) return text;
    
    const parser = new DOMParser;
    const xml = parser.parseFromString(text, "application/xml");
    const result = xmlToJSON(xml);
    if (result.error) {
      throw new Error(`Failed requesting DAV at ${url}${path}: ${JSON.stringify(result.error)}`);
    }
    if (result.multistatus) {
      result.multistatus.response = arrayify(result.multistatus.response);
      for (const r of result.multistatus.response) {
        if (r.error) {
          throw new Error(`Failed requesting DAV at ${url}${path}: ${r.href} ${r.error}`);
        }
      }
    }
    return result;
  }
  
  async function list(file) {
    if (!file.endsWith("/")) {
      file += "/";
    }
    const result = await requestDAV({
      method: "PROPFIND",
      path: file,
      contentType: "application/xml",
      body: 
        `<?xml version="1.0" encoding="utf-8" ?> 
        <propfind xmlns="DAV:">
          <allprop/>
        </propfind>`,
      headers: {
        "Depth": "1"
      }
    });
    
    const files = [];
    for (const entry of arrayify(result.multistatus.response)) {
      if (arrayify(entry.propstat).some(s => s.prop.resourcetype && s.prop.resourcetype.collection !== undefined)) {
        continue;
      }
      const base = `${url}${file}`;
      const absUrl = new URL(entry.href, base).href;
      const name = absUrl.slice(base.length);
      files.push(name);
    }
    return files;
  }
  
  async function get(file) {
    return await requestDAV({
      method: "GET",
      path: file,
      format: "text"
    });
  }
  
  async function put(file, data) {
    return await withDir(
      dirname(file),
      () => requestDAV({
        method: "PUT",
        path: file,
        contentType: "application/octet-stream",
        body: data
      })
    );
  }
  
  async function withDir(dir, cb) {
    try {
      return await cb();
    } catch (err) {
      if (err.code !== 409 && err.code !== 404 || dir === ".") {
        throw err;
      }
    }
    await withDir(dirname(dir), () =>
      requestDAV({
        method: "MKCOL",
        path: dir
      })
    );
    return await cb();
  }
  
  async function post(file, data) {
    try {
      return await withDir(
        dirname(file),
        () => requestDAV({
          method: "PUT",
          path: file,
          body: data,
          contentType: "octet-stream",
          headers: {
            // FIXME: seems webdav-server doesn't support etag, what about others?
            "If-None-Match": "*"
          }
        })
      );
    } catch (err) {
      if (err.code === 412) {
        err.code = "EEXIST";
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    // FIXME: support deleting collections?
    // FIXME: handle errors?
    try {
      await requestDAV({
        method: "DELETE",
        path: file
      });
    } catch (err) {
      if (err.code === 404) return;
      throw err;
    }
  }
  
  // async function acquireLock(mins) {
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
}

module.exports = createDrive;
