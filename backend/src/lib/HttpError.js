// backend/src/lib/HttpError.js
class HttpError extends Error {
  constructor(status = 500, code = 'internal_error', message = 'Internal server error', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = HttpError;