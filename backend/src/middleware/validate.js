// backend/src/middleware/validate.js
const { validationResult } = require('express-validator');
const { ZodError } = require('zod');

// Express-validator middleware
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      issues: errors.array()
    });
  }
  return next();
}

// Zod validation function (for backward compatibility)
validate.zod = function({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ success: false, error: 'validation_error', issues: err.errors });
      }
      return next(err);
    }
  };
};

module.exports = validate;