const router = require('express').Router();
const {
	register,
	login,
	getMe,
	sendForgotPasswordOtp,
	resetPasswordWithOtp,
	changePassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
