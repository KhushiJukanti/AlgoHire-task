const router = require('express').Router();
const batchController = require('../controllers/batch.controller');
const { authenticate, roles } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Every batch endpoint requires a valid session. Services also check ownership.
router.use(authenticate);

// Named paths must appear before /:id.
router.get('/inbox', roles('district', 'quality', 'state'), batchController.getReviewInbox);
router.get('/', batchController.listBatches);
router.post('/', roles('centre'), batchController.createBatch);
router.get('/:id', batchController.getBatch);
router.patch('/:id', roles('centre'), batchController.updateBatch);

router.get('/:id/candidates', batchController.listCandidates);
router.put('/:id/candidates', roles('centre'), batchController.replaceCandidates);
router.post(
  '/:id/candidates/import',
  roles('centre'),
  upload.single('file'),
  batchController.importCandidates,
);

router.post('/:id/submit', roles('centre'), batchController.submitBatch);
router.post('/:id/decisions', roles('district', 'quality', 'state'), batchController.reviewBatch);
router.get('/:id/history', batchController.getBatchHistory);
router.get('/:id/revisions', batchController.listBatchRevisions);
router.get('/:id/certificates', batchController.listBatchCertificates);
router.get('/:id/deliveries', batchController.listBatchDeliveries);

module.exports = router;
