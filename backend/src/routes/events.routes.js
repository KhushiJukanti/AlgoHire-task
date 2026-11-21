const router = require('express').Router();
const eventsController = require('../controllers/events.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', eventsController.streamEvents);

module.exports = router;
