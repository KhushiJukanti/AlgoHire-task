const router = require('express').Router();

// Each feature owns its routes and applies its own authentication middleware.
router.use('/auth', require('./auth.routes'));
router.use('/batches', require('./batch.routes'));
router.use('/certificates', require('./certificate.routes'));
router.use('/verify', require('./verification.routes'));
router.use('/centres', require('./centre.routes'));
router.use('/state', require('./state.routes'));
router.use('/events', require('./events.routes'));

module.exports = router;
