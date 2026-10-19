const express = require('express');
const router = express.Router();
const { scanReceipt, upload } = require('../controllers/receiptController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limit: 100 scans per 15 minutes per IP
const receiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many receipt scan requests, please try again later.' },
});

router.post('/scan', protect, receiptLimiter, upload.single('receipt'), scanReceipt);

module.exports = router;
