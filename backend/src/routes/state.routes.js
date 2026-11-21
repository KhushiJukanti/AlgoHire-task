const router = require('express').Router();
const stateController = require('../controllers/state.controller');
const { authenticate, roles } = require('../middlewares/auth');

// All state-office routes share the same role requirement.
router.use(authenticate, roles('state'));
router.get('/dashboard', stateController.getDashboard);
router.get('/escalations', stateController.listEscalations);
router.get('/jobs', stateController.getQueueStatus);
router.post('/batches/:id/retry-issuance', stateController.retryIssuance);

module.exports = router;
