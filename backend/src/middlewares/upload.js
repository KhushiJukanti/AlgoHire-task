const multer = require('multer');

// Only one spreadsheet may be uploaded, and it must be no larger than 2 MB.
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2 },
});
