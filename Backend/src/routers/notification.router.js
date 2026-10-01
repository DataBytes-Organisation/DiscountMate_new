const express = require('express');

const notificationController = require('../controllers/notification.controller');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

// CS-13-T3: Notifications are user-specific and require authentication.
router.get(
  '/',
  verifyToken,
  notificationController.getNotifications
);

router.patch(
  '/:id/read',
  verifyToken,
  notificationController.markNotificationAsRead
);

router.patch(
  '/read-all',
  verifyToken,
  notificationController.markAllNotificationsAsRead
);

module.exports = router;