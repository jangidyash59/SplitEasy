const express = require('express');
const router = express.Router();
const {
  addExpense, getGroupExpenses, getGroupBalances, getSimplifiedSettlements, settlePayment, deleteExpense,
  getFriends, getFriendExpenses, getFriendSettlements, getMyRecentExpenses,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');

router.post('/', protect, addExpense);
router.get('/recent', protect, getMyRecentExpenses);
router.get('/friends', protect, getFriends);
router.get('/friends-settlements', protect, getFriendSettlements);
router.get('/friends/:friendId', protect, getFriendExpenses);
router.get('/group/:groupId', protect, getGroupExpenses);
router.get('/group/:groupId/balances', protect, getGroupBalances);
router.get('/group/:groupId/settlements', protect, getSimplifiedSettlements);
router.post('/settle', protect, settlePayment);
router.delete('/:id', protect, deleteExpense);

module.exports = router;
