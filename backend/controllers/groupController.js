const Group = require('../models/Group');
const User = require('../models/User');
const redisClient = require('../config/redis');

const invalidateGroupCache = async (groupId) => {
  await redisClient.del(`group:settlements:${groupId}`);
  await redisClient.del(`group:balances:${groupId}`);
};

const notifyMembers = async (memberIds, message, type = 'expense', excludeId = null) => {
  const ids = memberIds.filter((id) => id.toString() !== excludeId?.toString());
  if (ids.length === 0) return;
  await User.updateMany(
    { _id: { $in: ids } },
    {
      $push: {
        notifications: {
          $each: [{ message, type, read: false, createdAt: new Date() }],
          $slice: -100,
        },
      },
    }
  );
};

// Helper: safely get a nested balance value from plain object
const getBalance = (groupBalances, fromId, toId) => {
  return (groupBalances[fromId] && groupBalances[fromId][toId]) || 0;
};

// Helper: update group balance (mirrors C++ updateGroupBalance)
const updateGroupBalance = (groupBalances, payerId, debtorId, amount) => {
  if (!groupBalances[payerId]) groupBalances[payerId] = {};
  if (!groupBalances[debtorId]) groupBalances[debtorId] = {};

  groupBalances[payerId][debtorId] = (groupBalances[payerId][debtorId] || 0) + amount;
  groupBalances[debtorId][payerId] = (groupBalances[debtorId][payerId] || 0) - amount;

  // Clean up near-zero values
  if (Math.abs(groupBalances[payerId][debtorId]) < 0.01) delete groupBalances[payerId][debtorId];
  if (Math.abs(groupBalances[debtorId][payerId]) < 0.01) delete groupBalances[debtorId][payerId];
};

// POST /api/groups
const createGroup = async (req, res) => {
  try {
    const { name, description, icon, memberIds } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

    const allMemberIds = [req.user._id.toString(), ...(memberIds || []).map(String)];
    const uniqueIds = [...new Set(allMemberIds)];

    // Initialize groupBalances as plain object for all members
    const groupBalances = {};
    for (const id of uniqueIds) {
      groupBalances[id] = {};
    }

    const group = await Group.create({
      name,
      description: description || '',
      icon: icon || '🏠',
      createdBy: req.user._id,
      members: uniqueIds,
      groupBalances,
    });

    const populated = await Group.findById(group._id).populate('members', '_id name email avatar');
    res.status(201).json({ success: true, group: populated });
  } catch (error) {
    console.error('createGroup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/groups
const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id, isActive: true })
      .populate('members', '_id name email avatar')
      .populate('createdBy', '_id name email')
      .sort({ updatedAt: -1 });

    const userId = req.user._id.toString();

    const enriched = groups.map((g) => {
      const gObj = g.toObject();
      const balMap = (gObj.groupBalances || {})[userId] || {};
      let netBalance = 0;
      for (const v of Object.values(balMap)) {
        if (typeof v === 'number') netBalance += v;
      }
      return { ...gObj, netBalance };
    });

    res.json({ success: true, groups: enriched });
  } catch (error) {
    console.error('getMyGroups error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/groups/:id
const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', '_id name email avatar')
      .populate('createdBy', '_id name email');

    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const isMember = group.members.some((m) => m._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a group member' });

    res.json({ success: true, group: group.toObject() });
  } catch (error) {
    console.error('getGroup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/groups/:id/members
const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const uid = userId.toString();
    if (group.members.some((m) => m.toString() === uid)) {
      return res.status(400).json({ success: false, message: 'User already in group' });
    }

    group.members.push(userId);
    if (!group.groupBalances[uid]) {
      group.groupBalances[uid] = {};
    }
    group.markModified('groupBalances');
    await group.save();

    const user = await User.findById(userId).select('name email avatar');
    await notifyMembers([userId], `You were added to group "${group.name}"`, 'group');
    await invalidateGroupCache(req.params.id);

    res.json({ success: true, message: 'Member added', user });
  } catch (error) {
    console.error('addMember error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/groups/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const { id: groupId, userId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const uid = userId.toString();
    const userBalMap = (group.groupBalances || {})[uid] || {};

    // Enforce "must settle before leaving" (mirrors C++ canUserLeaveGroup)
    for (const amount of Object.values(userBalMap)) {
      if (typeof amount === 'number' && Math.abs(amount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'User cannot leave with outstanding balances. Please settle first.',
        });
      }
    }

    group.members = group.members.filter((m) => m.toString() !== uid);
    delete group.groupBalances[uid];
    for (const memberId of Object.keys(group.groupBalances)) {
      if (group.groupBalances[memberId]) delete group.groupBalances[memberId][uid];
    }
    group.markModified('groupBalances');
    await group.save();
    await invalidateGroupCache(groupId);

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('removeMember error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createGroup, getMyGroups, getGroup, addMember, removeMember,
  notifyMembers, invalidateGroupCache, updateGroupBalance,
};
