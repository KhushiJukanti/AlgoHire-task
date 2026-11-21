const router = require('express').Router();
const certificateController = require('../controllers/certificate.controller');
const { authenticate, roles } = require('../middlewares/auth');
const { publicLimit } = require('../middlewares/rateLimit');

// Candidates use a signed download link instead of an officer's session.
router.get('/download/:token', publicLimit, certificateController.downloadWithToken);

router.use(authenticate);
router.get('/:id', certificateController.getCertificate);
router.get('/:id/pdf', certificateController.downloadPdf);
router.post(
  '/:id/download-link',
  roles('centre', 'state'),
  certificateController.createDownloadLink,
);
router.post('/:id/revoke', roles('state'), certificateController.revokeCertificate);
router.post('/:id/retry-delivery', roles('centre', 'state'), certificateController.retryDelivery);
router.get('/:id/mock-message', roles('centre', 'state'), certificateController.getMockMessage);

module.exports = router;
