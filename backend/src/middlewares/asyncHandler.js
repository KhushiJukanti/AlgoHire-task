// Forward rejected promises and synchronous errors to the central error middleware.
module.exports = function asyncHandler(handler) {
  return function handleRequest(req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
};
