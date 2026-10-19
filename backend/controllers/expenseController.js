const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { calculateSplit } = require('../utils/splitCalculator');
const { simplifyDebts } = require('../utils/debtSimplifier');
const redisClient = require('../config/redis');
const { notifyMembers, invalidateGroupCache } = require('./groupController');
const { sendSettlementEmail, sendExpenseEmail } = require('../utils/emailService');

// POST /api/expenses
const addExpense = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      description, totalAmount, paidBy, groupId,
      splitType, involvedUserIds, splitValues, category, notes, date,
    } = req.body;

    if (!description || !totalAmount || !paidBy || !involvedUserIds?.length) {
      if (session.inTransaction()) {
        try { await session.abortTransaction(); } catch {}
      }
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const amount = parseFloat(totalAmount);
    const parsedValues = (splitValues || []).map(Number).filter((v) => !isNaN(v));

    // Calculate splits using Strategy Pattern (translated from C++ SplitFactory)
    const splits = calculateSplit(amount, involvedUserIds, splitType || 'EQUAL', parsedValues);

    const [expense] = await Expense.create(
      [{
        description,
        totalAmount: amount,
        paidBy,
        groupId: groupId || null,
        splitType: splitType || 'EQUAL',
        splits,
        category: category || 'other',
        notes: notes || '',
        date: date ? new Date(date) : new Date(),
      }],
      { session }
    );

    const payerUser = await User.findById(paidBy).session(session);

    // Update group balances if group expense
    if (groupId) {
      const group = await Group.findById(groupId).session(session);
      if (!group) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

      const balances = group.groupBalances || {};
      if (!balances[paidBy.toString()]) balances[paidBy.toString()] = {};

      for (const split of splits) {
        const debtorId = split.userId.toString();
        const payerId = paidBy.toString();

        if (debtorId !== payerId) {
          if (!balances[payerId]) balances[payerId] = {};
          if (!balances[debtorId]) balances[debtorId] = {};

          balances[payerId][debtorId] = (balances[payerId][debtorId] || 0) + split.amount;
          balances[debtorId][payerId] = (balances[debtorId][payerId] || 0) - split.amount;

          if (Math.abs(balances[payerId][debtorId]) < 0.01) delete balances[payerId][debtorId];
          if (Math.abs(balances[debtorId][payerId]) < 0.01) delete balances[debtorId][payerId];
        }
      }

      group.groupBalances = balances;
      group.markModified('groupBalances');
      await group.save({ session });

      await invalidateGroupCache(groupId);

      // In-app notifications
      await notifyMembers(
        group.members.map((m) => m.toString()),
        `${payerUser?.name} added "${description}" ₹${amount}`,
        'expense',
        paidBy.toString()
      );

      // Email notifications to involved members
      for (const split of splits) {
        const debtorId = split.userId.toString();
        if (debtorId !== paidBy.toString()) {
          const debtorUser = await User.findById(debtorId).session(session);
          if (debtorUser?.email) {
            sendExpenseEmail({
              toEmail: debtorUser.email,
              toName: debtorUser.name,
              payerName: payerUser?.name || 'A friend',
              description,
              totalAmount: amount,
              yourShare: split.amount,
              groupName: group.name,
            }).catch(() => {});
          }
        }
      }
    } else {
      // Non-group (Individual) expense: track peer-to-peer balance directly in User.balances
      const payerBalances = payerUser.balances || {};

      for (const split of splits) {
        const debtorId = split.userId.toString();
        const payerId = paidBy.toString();

        if (debtorId !== payerId) {
          const debtorUser = await User.findById(debtorId).session(session);
          if (debtorUser) {
            const debtorBalances = debtorUser.balances || {};

            payerBalances[debtorId] = (payerBalances[debtorId] || 0) + split.amount;
            debtorBalances[payerId] = (debtorBalances[payerId] || 0) - split.amount;

            if (Math.abs(payerBalances[debtorId]) < 0.01) delete payerBalances[debtorId];
            if (Math.abs(debtorBalances[payerId]) < 0.01) delete debtorBalances[payerId];

            debtorUser.balances = debtorBalances;
            debtorUser.markModified('balances');
            debtorUser.notifications.push({
              message: `${payerUser?.name} added individual expense "${description}" (Your share: ₹${split.amount})`,
              type: 'expense',
              read: false,
            });
            await debtorUser.save({ session });

            // Email notification to debtor
            if (debtorUser.email) {
              sendExpenseEmail({
                toEmail: debtorUser.email,
                toName: debtorUser.name,
                payerName: payerUser?.name || 'A friend',
                description,
                totalAmount: amount,
                yourShare: split.amount,
                groupName: null,
              }).catch(() => {});
            }
          }
        }
      }

      payerUser.balances = payerBalances;
      payerUser.markModified('balances');
      await payerUser.save({ session });
    }

    await session.commitTransaction();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', '_id name email avatar')
      .populate('splits.userId', '_id name email avatar');

    const io = req.app.get('io');
    if (io) {
      if (groupId) {
        io.to(`group:${groupId}`).emit('expense:added', populated);
      } else {
        involvedUserIds.forEach((uid) => {
          io.to(`user:${uid}`).emit('expense:added', populated);
        });
      }
    }

    res.status(201).json({ success: true, expense: populated });
  } catch (error) {
    if (session.inTransaction()) {
      try { await session.abortTransaction(); } catch {}
    }
    console.error('addExpense error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    try { await session.endSession(); } catch {}
  }
};

// GET /api/expenses/group/:groupId
const getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;

    const expenses = await Expense.find({ groupId })
      .populate('paidBy', '_id name email avatar')
      .populate('splits.userId', '_id name email avatar')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Expense.countDocuments({ groupId });

    res.json({ success: true, expenses, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/expenses/group/:groupId/balances
const getGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const cached = await redisClient.get(`group:balances:${groupId}`);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, ...parsed, fromCache: true });
    }

    const group = await Group.findById(groupId).populate('members', '_id name email avatar');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const balances = group.groupBalances || {};
    const result = { balances, members: group.members };
    await redisClient.set(`group:balances:${groupId}`, result);

    res.json({ success: true, ...result, fromCache: false });
  } catch (error) {
    console.error('getGroupBalances error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/expenses/group/:groupId/settlements — Greedy Min Cash Flow (cached)
const getSimplifiedSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;

    const cached = await redisClient.get(`group:settlements:${groupId}`);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, transactions: parsed, fromCache: true });
    }

    const group = await Group.findById(groupId).populate('members', '_id name email avatar');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const balancesObj = group.groupBalances || {};
    const transactions = simplifyDebts(balancesObj);

    const memberMap = {};
    for (const m of group.members) {
      memberMap[m._id.toString()] = { _id: m._id, name: m.name, email: m.email, avatar: m.avatar };
    }

    const enriched = transactions.map((t) => ({
      from: memberMap[t.from] || { _id: t.from, name: t.from },
      to: memberMap[t.to] || { _id: t.to, name: t.to },
      amount: t.amount,
    }));

    await redisClient.set(`group:settlements:${groupId}`, enriched);
    res.json({ success: true, transactions: enriched, fromCache: false });
  } catch (error) {
    console.error('getSimplifiedSettlements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/expenses/settle
const settlePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { groupId, fromUserId, toUserId, amount } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Missing required settlement fields' });
    }

    const fromId = fromUserId.toString();
    const toId = toUserId.toString();
    const settleAmt = parseFloat(amount);

    // Idempotency lock
    const lockKey = `lock:settle:${groupId || 'individual'}:${fromId}:${toId}`;
    const locked = await redisClient.acquireLock(lockKey, 15);
    if (!locked) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: 'Settlement already in progress.' });
    }

    try {
      let groupName = null;

      if (groupId) {
        const group = await Group.findById(groupId).session(session);
        if (!group) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: 'Group not found' });
        }
        groupName = group.name;

        const balances = group.groupBalances || {};
        if (!balances[fromId]) balances[fromId] = {};
        if (!balances[toId]) balances[toId] = {};

        balances[fromId][toId] = (balances[fromId][toId] || 0) + settleAmt;
        balances[toId][fromId] = (balances[toId][fromId] || 0) - settleAmt;

        if (Math.abs(balances[fromId][toId]) < 0.01) delete balances[fromId][toId];
        if (Math.abs(balances[toId][fromId]) < 0.01) delete balances[toId][fromId];

        group.groupBalances = balances;
        group.markModified('groupBalances');
        await group.save({ session });
        await invalidateGroupCache(groupId);
      } else {
        // Individual / Friend Global Settlement: Single point of settlement across all groups & direct payments
        // NOTE: must execute sequentially on the same session to prevent MongoServerError
        const fromUser = await User.findById(fromId).session(session);
        const toUser = await User.findById(toId).session(session);

        if (fromUser && toUser) {
          let remainingSettle = settleAmt;
          const fromBal = fromUser.balances || {};
          const toBal = toUser.balances || {};

          // 1. First, offset direct peer debt where fromUser owes toUser
          if (fromBal[toId] && fromBal[toId] < -0.01 && remainingSettle > 0.01) {
            const directDebt = Math.abs(fromBal[toId]);
            const payDirect = Math.min(remainingSettle, directDebt);

            fromBal[toId] += payDirect;
            toBal[fromId] = (toBal[fromId] || 0) - payDirect;

            if (Math.abs(fromBal[toId]) < 0.01) delete fromBal[toId];
            if (Math.abs(toBal[fromId]) < 0.01) delete toBal[fromId];

            remainingSettle -= payDirect;
          }

          // 2. Second, offset shared group debts where fromId owes toId
          if (remainingSettle > 0.01) {
            const sharedGroups = await Group.find({
              members: { $all: [fromId, toId] },
              isActive: true,
            }).session(session);

            for (const g of sharedGroups) {
              if (remainingSettle <= 0.01) break;
              const gBalances = g.groupBalances || {};

              // Check if fromId owes toId in this group (toId balance against fromId is positive)
              if (gBalances[toId] && gBalances[toId][fromId] > 0.01) {
                const groupDebt = gBalances[toId][fromId];
                const payGroup = Math.min(remainingSettle, groupDebt);

                gBalances[toId][fromId] -= payGroup;
                if (!gBalances[fromId]) gBalances[fromId] = {};
                gBalances[fromId][toId] = (gBalances[fromId][toId] || 0) + payGroup;

                if (Math.abs(gBalances[toId][fromId]) < 0.01) delete gBalances[toId][fromId];
                if (Math.abs(gBalances[fromId][toId]) < 0.01) delete gBalances[fromId][toId];

                g.groupBalances = gBalances;
                g.markModified('groupBalances');
                await g.save({ session });
                await invalidateGroupCache(g._id);

                remainingSettle -= payGroup;
              }
            }
          }

          // 3. Any remaining settle amount is applied to direct balances
          if (remainingSettle > 0.01) {
            fromBal[toId] = (fromBal[toId] || 0) + remainingSettle;
            toBal[fromId] = (toBal[fromId] || 0) - remainingSettle;

            if (Math.abs(fromBal[toId]) < 0.01) delete fromBal[toId];
            if (Math.abs(toBal[fromId]) < 0.01) delete toBal[fromId];
          }

          fromUser.balances = fromBal;
          toUser.balances = toBal;

          fromUser.markModified('balances');
          toUser.markModified('balances');

          await fromUser.save({ session });
          await toUser.save({ session });
        }
      }

      // Record as settlement expense
      await Expense.create(
        [{
          description: 'Settlement',
          totalAmount: settleAmt,
          paidBy: fromUserId,
          groupId: groupId || null,
          splitType: 'EXACT',
          splits: [{ userId: toUserId, amount: settleAmt }],
          isSettlement: true,
          category: 'other',
        }],
        { session }
      );

      await session.commitTransaction();

      // Retrieve user details for notification and email (post-transaction)
      const fromUser = await User.findById(fromUserId).select('name email');
      const toUser = await User.findById(toUserId).select('name email');

      await notifyMembers(
        [toUserId],
        `${fromUser?.name} settled ₹${settleAmt} with ${toUser?.name}`,
        'settlement'
      );

      // Send Email Notification
      if (toUser?.email) {
        sendSettlementEmail({
          toEmail: toUser.email,
          toName: toUser.name,
          fromName: fromUser?.name || 'Someone',
          amount: settleAmt,
          groupName,
        }).catch(() => {});
      }

      const io = req.app.get('io');
      if (io) {
        if (groupId) {
          io.to(`group:${groupId}`).emit('settlement:done', { fromUserId, toUserId, amount: settleAmt });
        } else {
          io.to(`user:${fromUserId}`).emit('settlement:done', { fromUserId, toUserId, amount: settleAmt });
          io.to(`user:${toUserId}`).emit('settlement:done', { fromUserId, toUserId, amount: settleAmt });
        }
      }

      res.json({ success: true, message: 'Settlement recorded successfully!' });
    } finally {
      await redisClient.releaseLock(lockKey);
    }
  } catch (error) {
    if (session.inTransaction()) {
      try { await session.abortTransaction(); } catch {}
    }
    console.error('settlePayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    try { await session.endSession(); } catch {}
  }
};

// GET /api/expenses/friends — Get all friends with absolute detailed balances (direct + shared groups)
const getFriends = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const currentUser = await User.findById(req.user._id);
    const peerBalances = currentUser.balances || {};

    // 1. Fetch all active groups the user belongs to
    const userGroups = await Group.find({
      members: req.user._id,
      isActive: true,
    }).select('_id name icon groupBalances members');

    // 2. Also look for users involved in non-group expenses with this user
    const nonGroupExpenses = await Expense.find({
      groupId: null,
      $or: [
        { paidBy: req.user._id },
        { 'splits.userId': req.user._id },
      ],
    })
      .populate('paidBy', '_id name email avatar')
      .populate('splits.userId', '_id name email avatar')
      .sort({ date: -1 });

    const friendIdsSet = new Set(Object.keys(peerBalances));
    nonGroupExpenses.forEach((exp) => {
      const payerId = (exp.paidBy?._id || exp.paidBy).toString();
      if (payerId !== currentUserId) friendIdsSet.add(payerId);
      exp.splits.forEach((s) => {
        const uid = (s.userId?._id || s.userId).toString();
        if (uid !== currentUserId) friendIdsSet.add(uid);
      });
    });

    userGroups.forEach((g) => {
      g.members.forEach((m) => {
        const mid = m.toString();
        if (mid !== currentUserId) friendIdsSet.add(mid);
      });
    });

    const friendIds = Array.from(friendIdsSet);
    const friendUsers = await User.find({ _id: { $in: friendIds } }).select('_id name email avatar');

    const friends = friendUsers.map((fu) => {
      const fId = fu._id.toString();
      const directBalance = typeof peerBalances[fId] === 'number' ? peerBalances[fId] : 0;

      // Group breakdown for this friend
      const groupBreakdown = [];
      let totalGroupBalance = 0;

      userGroups.forEach((g) => {
        const isMember = g.members.some((m) => m.toString() === fId);
        if (isMember) {
          const gBalances = g.groupBalances || {};
          let balanceInGroup = 0;
          if (gBalances[currentUserId] && typeof gBalances[currentUserId][fId] === 'number') {
            balanceInGroup = gBalances[currentUserId][fId];
          } else if (gBalances[fId] && typeof gBalances[fId][currentUserId] === 'number') {
            balanceInGroup = -gBalances[fId][currentUserId];
          }

          if (Math.abs(balanceInGroup) > 0.01) {
            groupBreakdown.push({
              groupId: g._id,
              groupName: g.name,
              groupIcon: g.icon,
              balance: balanceInGroup,
            });
            totalGroupBalance += balanceInGroup;
          }
        }
      });

      // Total absolute net balance across direct peer balance and all shared group balances
      const totalNetBalance = directBalance + totalGroupBalance;

      const lastExp = nonGroupExpenses.find(
        (e) => (e.paidBy?._id || e.paidBy).toString() === fId ||
               e.splits.some((s) => (s.userId?._id || s.userId).toString() === fId)
      );

      return {
        user: fu,
        netBalance: totalNetBalance,
        directBalance,
        totalGroupBalance,
        groupBreakdown,
        lastExpense: lastExp ? {
          description: lastExp.description,
          totalAmount: lastExp.totalAmount,
          date: lastExp.date,
          isSettlement: lastExp.isSettlement,
        } : null,
      };
    });

    // Sort: friends with non-zero balances first (highest absolute balance first), then settled
    friends.sort((a, b) => {
      const aAbs = Math.abs(a.netBalance);
      const bAbs = Math.abs(b.netBalance);
      if (aAbs > 0.01 && bAbs <= 0.01) return -1;
      if (bAbs > 0.01 && aAbs <= 0.01) return 1;
      return bAbs - aAbs;
    });

    res.json({ success: true, friends });
  } catch (error) {
    console.error('getFriends error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/expenses/friends/:friendId — Get complete detailed breakdown & all shared expenses with a specific friend
const getFriendExpenses = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const { friendId } = req.params;

    const friend = await User.findById(friendId).select('_id name email avatar');
    if (!friend) return res.status(404).json({ success: false, message: 'Friend not found' });

    const currentUser = await User.findById(req.user._id);
    const directBalance = (currentUser.balances && currentUser.balances[friendId]) || 0;

    // Find all active groups shared between current user and this friend
    const sharedGroups = await Group.find({
      members: { $all: [currentUserId, friendId] },
      isActive: true,
    }).select('_id name icon groupBalances members');

    const groupBreakdown = [];
    let totalGroupBalance = 0;

    sharedGroups.forEach((g) => {
      const gBalances = g.groupBalances || {};
      let balanceInGroup = 0;
      if (gBalances[currentUserId] && typeof gBalances[currentUserId][friendId] === 'number') {
        balanceInGroup = gBalances[currentUserId][friendId];
      } else if (gBalances[friendId] && typeof gBalances[friendId][currentUserId] === 'number') {
        balanceInGroup = -gBalances[friendId][currentUserId];
      }

      if (Math.abs(balanceInGroup) > 0.01) {
        groupBreakdown.push({
          groupId: g._id,
          groupName: g.name,
          groupIcon: g.icon,
          balance: balanceInGroup,
        });
        totalGroupBalance += balanceInGroup;
      }
    });

    const totalNetBalance = directBalance + totalGroupBalance;
    const sharedGroupIds = sharedGroups.map((g) => g._id);

    // Fetch all shared expenses (direct OR shared groups) involving either user
    const expenses = await Expense.find({
      $or: [
        {
          groupId: null,
          $or: [
            { paidBy: currentUserId, 'splits.userId': friendId },
            { paidBy: friendId, 'splits.userId': currentUserId },
          ],
        },
        {
          groupId: { $in: sharedGroupIds },
          $or: [
            { paidBy: currentUserId, 'splits.userId': friendId },
            { paidBy: friendId, 'splits.userId': currentUserId },
            { paidBy: { $in: [currentUserId, friendId] } },
          ],
        },
      ],
    })
      .populate('paidBy', '_id name email avatar')
      .populate('splits.userId', '_id name email avatar')
      .populate('groupId', '_id name icon')
      .sort({ date: -1 })
      .limit(60);

    res.json({
      success: true,
      friend,
      netBalance: totalNetBalance,
      directBalance,
      totalGroupBalance,
      groupBreakdown,
      expenses,
    });
  } catch (error) {
    console.error('getFriendExpenses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/expenses/friends-settlements — Greedy Min Cash Flow for peer balances
const getFriendSettlements = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const currentUser = await User.findById(req.user._id);
    const peerBalances = currentUser.balances || {};

    // Build net balance map incorporating direct balances and group balances
    const userGroups = await Group.find({
      members: req.user._id,
      isActive: true,
    }).select('_id groupBalances members');

    const balancesObj = {
      [currentUserId]: {},
    };

    // Add direct balances
    for (const [friendId, amt] of Object.entries(peerBalances)) {
      if (typeof amt === 'number' && Math.abs(amt) > 0.01) {
        balancesObj[currentUserId][friendId] = (balancesObj[currentUserId][friendId] || 0) + amt;
        if (!balancesObj[friendId]) balancesObj[friendId] = {};
        balancesObj[friendId][currentUserId] = (balancesObj[friendId][currentUserId] || 0) - amt;
      }
    }

    // Add group balances
    userGroups.forEach((g) => {
      const gBalances = g.groupBalances || {};
      if (gBalances[currentUserId]) {
        for (const [friendId, amt] of Object.entries(gBalances[currentUserId])) {
          if (typeof amt === 'number' && Math.abs(amt) > 0.01) {
            balancesObj[currentUserId][friendId] = (balancesObj[currentUserId][friendId] || 0) + amt;
            if (!balancesObj[friendId]) balancesObj[friendId] = {};
            balancesObj[friendId][currentUserId] = (balancesObj[friendId][currentUserId] || 0) - amt;
          }
        }
      }
    });

    const transactions = simplifyDebts(balancesObj);

    // Populate user info
    const allUserIds = new Set();
    transactions.forEach((t) => {
      allUserIds.add(t.from);
      allUserIds.add(t.to);
    });

    const users = await User.find({ _id: { $in: Array.from(allUserIds) } }).select('_id name email avatar');
    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u; });

    const enriched = transactions.map((t) => ({
      from: userMap[t.from] || { _id: t.from, name: 'Unknown' },
      to: userMap[t.to] || { _id: t.to, name: 'Unknown' },
      amount: t.amount,
    }));

    res.json({ success: true, transactions: enriched });
  } catch (error) {
    console.error('getFriendSettlements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (expense.paidBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this expense' });
    }

    // Reverse balance changes
    if (expense.groupId && !expense.isSettlement) {
      const group = await Group.findById(expense.groupId);
      if (group) {
        const balances = group.groupBalances || {};
        const payerId = expense.paidBy.toString();

        for (const split of expense.splits) {
          const debtorId = split.userId.toString();
          if (debtorId !== payerId) {
            if (!balances[payerId]) balances[payerId] = {};
            if (!balances[debtorId]) balances[debtorId] = {};

            balances[payerId][debtorId] = (balances[payerId][debtorId] || 0) - split.amount;
            balances[debtorId][payerId] = (balances[debtorId][payerId] || 0) + split.amount;

            if (Math.abs(balances[payerId][debtorId]) < 0.01) delete balances[payerId][debtorId];
            if (Math.abs(balances[debtorId][payerId]) < 0.01) delete balances[debtorId][payerId];
          }
        }

        group.groupBalances = balances;
        group.markModified('groupBalances');
        await group.save();
        await invalidateGroupCache(expense.groupId.toString());
      }
    } else if (!expense.groupId && !expense.isSettlement) {
      // Reverse peer balances
      const payerUser = await User.findById(expense.paidBy);
      if (payerUser) {
        const payerBal = payerUser.balances || {};
        for (const split of expense.splits) {
          const debtorId = split.userId.toString();
          if (debtorId !== expense.paidBy.toString()) {
            const debtorUser = await User.findById(debtorId);
            if (debtorUser) {
              const debtorBal = debtorUser.balances || {};

              payerBal[debtorId] = (payerBal[debtorId] || 0) - split.amount;
              debtorBal[expense.paidBy.toString()] = (debtorBal[expense.paidBy.toString()] || 0) + split.amount;

              if (Math.abs(payerBal[debtorId]) < 0.01) delete payerBal[debtorId];
              if (Math.abs(debtorBal[expense.paidBy.toString()]) < 0.01) delete debtorBal[expense.paidBy.toString()];

              debtorUser.balances = debtorBal;
              debtorUser.markModified('balances');
              await debtorUser.save();
            }
          }
        }
        payerUser.balances = payerBal;
        payerUser.markModified('balances');
        await payerUser.save();
      }
    }

    await expense.deleteOne();
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error('deleteExpense error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/expenses/recent — Returns all recent expenses the user is involved in (group + non-group)
const getMyRecentExpenses = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { 'splits.userId': userId },
      ],
    })
      .populate('paidBy', '_id name email avatar')
      .populate('splits.userId', '_id name email avatar')
      .populate('groupId', '_id name icon')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);

    res.json({ success: true, expenses });
  } catch (error) {
    console.error('getMyRecentExpenses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addExpense, getGroupExpenses, getGroupBalances,
  getSimplifiedSettlements, settlePayment, deleteExpense,
  getFriends, getFriendExpenses, getFriendSettlements,
  getMyRecentExpenses,
};
