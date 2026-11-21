const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const { loginLimit } = require('../middlewares/rateLimit');

router.post('/login', loginLimit, authController.login);
router.get('/demo-users', loginLimit, authController.listDemoUsers);
router.post('/demo-login', loginLimit, authController.demoLogin);
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
