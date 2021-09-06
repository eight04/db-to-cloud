/* global self */
const {createRequest} = require("../request");

function nodesToObject(obj, nodes) {
  for (const n of nodes) {
    obj[n.localName] = n.children.length ? n.children : n.textContent; 
  }  
}

function arrayify(o) {
  return Array.isArray(o) ? o : [o];
}

function xmlToJSON(node) {
  if (!node.children.length) {
    return node.textContent;
  }
  const o = {};
  for (const c of node.children) {
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
  const request = createRequest({fetch, username, password});
  return {
    name: "webdav",
    get,
    put,
    post,
    delete: delete_,
    list,
    init
  };
  
  // async function requestDAV({path, body, ...args}) {
    // return request({
      // method: "POST",
      // path: `${url}/${path}`,
      // contentType: "application/xml",
      // body: JSON.stringify(body),
      // ...args
    // });
  // }
  
  async function list(file) {
    const path = `${url}${file}`
    const text = await request({
      method: "PROPFIND",
      path,
      contentType: "application/xml",
      body: 
        `<?xml version="1.0" encoding="utf-8" ?> 
        <propfind xmlns="DAV:">
          <prop>
            <displayname/>
            <resourcetype/>
          </prop>
        </propfind>`,
      headers: {
        "Depth": "1"
      }
    });
    const parser = new DOMParser;
    const xml = parser.parseFromString(text, "application/xml");
    const result = xmlToJSON(xml.documentElement);
    
    const files = [];  
    for (const entry of arrayify(result.multistatus.response)) {
      if (!/200 ok/i.test(entry.propstat.status)) {
        throw new Error(`Failed requesting PROPFIND: ${entry.href} ${entry.propstat.status}`);
      }
      const absUrl = new URL(entry.href, path).href;
      const file = absUrl.slice(path.length + 1);
      files.push(file);
    }
    return files;
  }
  
  async function get(file) {
    return await request({
      method: "GET",
      path: `${url}${file}`,
      format: "text"
    });
  }
  
  async function put(file, data, retry = true) {
    try {
      return await request({
        method: "PUT",
        path: `${url}${file}`,
        contentType: "application/octet-stream",
        body: data
      });
    } catch (err) {
      if (err.code !== 409 || !retry) {
        throw err;
      }
      await prepareDir(file);
      return await put(file, data, false);
    }
  }
  
  async function prepareDir(file, recursive = true) {
    const dir = dirname(file);
    if (dir === ".") {
      throw new Error(`Unable to prepare dir for ${file}`);
    }
    
    try {
      await request({
        method: "MKCOL",
        path: ${url}${dir}
      });
    } catch (err) {
      if (err.code !== 409 || !recursive) {
        throw err;
      }
      await prepareDir(dir);
      return await prepareDir(file, false);
    }
  }
  
  async function post(file, data) {
    try {
      return await put(file, data, "add");
    } catch (err) {
      if (err.code === 409 && err.message.includes("conflict")) {
        err.code = "EEXIST";
      }
      throw err;
    }
  }
  
  async function delete_(file) {
    try {
      // FIXME: support deleting collections
      await request({
        method: "DELETE",
        path: `${url}${file}`
      });
    } catch (err) {
      if (err.code !== 404) {
        throw err;
      }
    }
  }
}

module.exports = createDrive;
