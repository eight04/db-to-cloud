class CustomError extends Error {
  constructor(code, origin) {
    super(origin.message);
    this.name = origin.name;
    this.code = code;
    this.origin = origin;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

module.exports = {CustomError};
