class CustomError extends Error {
  constructor(code, origin, message = origin.message || "An error occured in db-to-cloud") {
    super(message);
    if (origin.name) {
      this.name = origin.name;
    }
    this.code = code;
    this.origin = origin;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

module.exports = {CustomError};
