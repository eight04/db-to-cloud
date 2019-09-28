function createDrive({
  folder,
  getFs = () => require("fs").promises
}) {
  let fs;
  let path;
  return {
    name: "fs-drive",
    init,
    get,
    put,
    post,
    delete: delete_,
    list
  };
  
  async function init() {
    [fs, path] = await Promise.all([
      getFs(),
      Promise.resolve(require("path"))
    ]);
  }
  
  async function list(file) {
    return await fs.readdir(path.join(folder, file));
  }
  
  async function get(file) {
    return await fs.readFile(path.join(folder, file), "utf8");
  }
  
  async function put(file, data) {
    await writeFileRecursive(path.join(folder, file), data);
  }
  
  async function post(file, data) {
    await writeFileRecursive(path.join(folder, file), data, "wx");
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
  
  async function writeFileRecursive(file, data, flag = "w") {
    try {
      await fs.writeFile(file, data, {flag});
    } catch (err) {
      if (err.code === "ENOENT") {
        await fs.mkdir(path.parse(file).dir, {recursive: true});
        await fs.writeFile(file, data, {flag});
        return;
      }
      throw err;
    }
  }
}

module.exports = createDrive;
