const express = require('express');
const router = express.Router();
const { createGroup, getMyGroups, getGroup, addMember, removeMember } = require('../controllers/groupController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createGroup);
router.get('/', protect, getMyGroups);
router.get('/:id', protect, getGroup);
router.post('/:id/members', protect, addMember);
router.delete('/:id/members/:userId', protect, removeMember);

module.exports = router;
