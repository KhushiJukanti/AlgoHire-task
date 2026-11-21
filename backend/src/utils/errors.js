class ApiError extends Error {
  status;
  details;
  constructor(status, message, details) {
    (super(message), (this.status = status), (this.details = details));
  }
}
function assert(condition, status, message) {
  if (!condition) throw new ApiError(status, message);
}

module.exports = { ApiError, assert };
