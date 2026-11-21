const router = require('express').Router();
const centreController = require('../controllers/centre.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);
router.get('/', centreController.listCentres);

module.exports = router;
