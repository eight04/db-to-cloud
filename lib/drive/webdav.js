/* global self */
const {dirname} = require("path");

const {createRequest} = require("../request");

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
  };
  
  async function requestDAV({path, ...args}) {
    const text = await request({
      path: `${url}${path}`,
      ...args
    });
    if (args.format || typeof text !== "string") return text;
    
    const parser = new DOMParser;
    const xml = parser.parseFromString(text, "application/xml");
    const result = xmlToJSON(xml.documentElement);
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
          <propname>
            <displayname/>
            <resourcetype/>
          </propname>
        </propfind>`,
      headers: {
        "Depth": "1"
      }
    });
    
    const files = [];
    for (const entry of arrayify(result.multistatus.response)) {
      if (
        entry.propstat.prop.resourcetype &&
        entry.propstat.prop.resourcetype.collection !== undefined
      ) {
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
  
  async function put(file, data, retry = true) {
    try {
      return await requestDAV({
        method: "PUT",
        path: file,
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
      await requestDAV({
        method: "MKCOL",
        path: dir
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
    return await requestDAV({
      method: "POST",
      path: file,
      body: data,
      contentType: "octet-stream"
    });
  }
  
  async function delete_(file) {
    // FIXME: support deleting collections?
    // FIXME: handle errors?
    await requestDAV({
      method: "DELETE",
      path: file
    });
  }
}

module.exports = createDrive;
