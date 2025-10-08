// backend/src/lib/asyncHandler.js
// Wrap async route handlers so thrown errors are forwarded to Express error handler
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};