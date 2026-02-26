const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect);

router.get('/', notificationController.listNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/refresh-expiry', notificationController.refreshExpiryNotifications);

module.exports = router;
