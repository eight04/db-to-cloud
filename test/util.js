const readline = require("readline");

const FormData = require("form-data");

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

const _append = FormData.prototype.append;
FormData.prototype.append = function (name, blob) {
  return _append.call(this, name, blob.parts.join(""), {contentType: blob.options.type});
};

class DummyBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
}

module.exports = {
  question,
  FormData,
  DummyBlob
};
