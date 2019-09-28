const {createLock} = require("@eight04/read-write-lock");

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

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

function createRequest({fetch, cooldown = 0, getAccessToken}) {
  const lock = createLock();
  return args => {
    return lock.write(async done => {
      try {
        return await doRequest(args);
      } finally {
        if (!cooldown || !args.method || args.method === "GET") {
          done();
        } else {
          setTimeout(done, cooldown);
        }
      }
    });
  };
  
  async function doRequest({path, contentType, headers: _headers, format, ...args}) {
    const headers = {
      "Authorization": `Bearer ${await getAccessToken()}`
    };
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    Object.assign(headers, _headers);
    while (true) { // eslint-disable-line no-constant-condition
      const res = await fetch(path, {
        headers,
        ...args
      });
      if (!res.ok) {
        const retry = res.headers.get("Retry-After");
        if (retry) {
          const time = Number(retry);
          if (time) {
            await delay(time * 1000);
            continue;
          }
        }
        const text = await res.text();
        throw new RequestError(`failed to fetch [${res.status}]: ${text}`, res);
      }
      if (format) {
        return await res[format]();
      }
      const resContentType = res.headers.get("Content-Type");
      if (/application\/json/.test(resContentType)) {
        return await res.json();
      }
      return await res.text();
    }
  }
}

module.exports = {createRequest, RequestError};
