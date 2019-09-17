function createDrive({
  folder,
  getFs = () => Promise.resolve(require("fs")).then(fs => fs.promises)
}) {
  let lockFile;
  let fs;
  let path;
  return {init, get, put, delete: delete_, acquireLock, releaseLock};
  
  async function init() {
    [fs, path] = await Promise.resolve([
      getFs(),
      Promise.resolve(require("path"))
    ]);
    lockFile = path.join(folder, "lock.json");
  }
  
  async function get(file) {
    try {
      return JSON.parse(await fs.readFile(path.join(folder, file), "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") {
        err.code = 404;
      }
      throw err;
    }
  }
  
  async function put(file, data) {
    await writeFileRecursive(path.join(folder, file), JSON.stringify(data));
  }
  
  async function delete_(file) {
    try {
      await fs.unlink(path.join(folder, file));
    } catch (err) {
      if (err.code === "ENOENT") {
        return;
      }
      throw err;
    }
  }
  
  async function writeFileRecursive(file, ...args) {
    try {
      await fs.writeFile(file, ...args);
    } catch (err) {
      if (err.code === "ENOENT") {
        await fs.mkdir(path.parse(file).dir, {recursive: true});
        await fs.writeFile(file, ...args);
        return;
      }
      throw err;
    }
  }
  
  async function acquireLock(expire) {
    try {
      await writeFileRecursive(
        lockFile,
        JSON.stringify({expire: Date.now() + expire * 60 * 1000}),
        {flag: "wx"}
      );
    } catch (err) {
      if (err.code === "EEXIST") {
        const data = JSON.parse(await fs.readFile(lockFile, "utf8"));
        if (Date.now() > data.expire) {
          await fs.unlink(lockFile);
        }
      }
      throw err;
    }
  }
  
  async function releaseLock() {
    await fs.unlink(lockFile);
  }
}

module.exports = createDrive;
