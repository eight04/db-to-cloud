class LockError extends Error {
  constructor(expire) {
    super(`The database is locked. Will expire at ${new Date(expire).toLocaleString()}`);
    this.expire = expire;
  }
}

module.exports = {LockError};
