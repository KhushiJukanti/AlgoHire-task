const router = require('express').Router();
const certificateController = require('../controllers/certificate.controller');
const { publicLimit } = require('../middlewares/rateLimit');

// Verification is public. It never grants access to the private PDF.
router.get('/:token', publicLimit, certificateController.verifyCertificate);

module.exports = router;
