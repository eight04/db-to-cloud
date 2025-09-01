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
    Promise.resolve(fn())
      .then(q.resolve, q.reject);
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

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
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

function createXMLParser(DOMParser) {
  let parser;
  return function parseXML(text) {
    if (!parser) {
      parser = new DOMParser();
    }
    const xml = parser.parseFromString(text, "application/xml");
    return xmlToJSON(xml);
  };
}

module.exports = {debounced, delay, createXMLParser, xmlToJSON};
