const express = require('express');
const router = express.Router();
const {
  register, login, getMe, searchUsers, getNotifications, markNotificationsRead,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/users/search', protect, searchUsers);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read', protect, markNotificationsRead);

module.exports = router;
