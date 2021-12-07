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

module.exports = {debounced, delay};
