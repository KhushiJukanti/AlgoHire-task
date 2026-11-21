const { ZodError } = require('zod');
const { ApiError } = require('../utils/errors');
const errorHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: error.message,
      details: error.details,
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      details: error.issues,
    });
    return;
  }
  if (error.code === 11000) {
    res.status(409).json({
      error: 'This record or decision already exists',
    });
    return;
  }
  if (error.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid identifier',
    });
    return;
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'Maximum upload size is 2 MB',
    });
    return;
  }
  if (error.name === 'MulterError' || error.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'Invalid request payload',
    });
    return;
  }
  if (error.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request body too large',
    });
    return;
  }
  console.error('Request failed:', error.name);
  res.status(500).json({
    error: 'Internal server error',
  });
};

module.exports = { errorHandler };
