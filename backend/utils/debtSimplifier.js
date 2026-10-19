/**
 * Debt Simplifier - Greedy Minimum Cash Flow Algorithm
 * Translated from C++ DebtSimplifier class in SplitwiseApp.cpp
 *
 * Given a groupBalances map: { userId -> { otherUserId -> netAmount } }
 * Computes the minimum set of transactions (at most N-1) to settle all debts.
 *
 * Algorithm:
 * 1. Compute net balance for each person (totalReceived - totalOwed)
 * 2. Split into creditors (+) and debtors (-)
 * 3. Greedily match largest creditor with largest debtor
 */

const simplifyDebts = (groupBalances) => {
  // Step 1: Compute net amounts
  const netAmounts = {};

  for (const [userId, balanceMap] of Object.entries(groupBalances)) {
    if (!netAmounts[userId]) netAmounts[userId] = 0;
    for (const [otherUserId, amount] of Object.entries(balanceMap)) {
      if (amount > 0) {
        // userId is creditor, otherUserId is debtor
        netAmounts[userId] = (netAmounts[userId] || 0) + amount;
        netAmounts[otherUserId] = (netAmounts[otherUserId] || 0) - amount;
      }
    }
  }

  // Step 2: Split into creditors and debtors
  const creditors = []; // { userId, amount }
  const debtors = [];   // { userId, amount (positive) }

  for (const [userId, net] of Object.entries(netAmounts)) {
    if (net > 0.01) creditors.push({ userId, amount: net });
    else if (net < -0.01) debtors.push({ userId, amount: -net });
  }

  // Sort descending (largest first) — matches C++ sort
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Step 3: Greedy matching — produces simplified transactions list
  const transactions = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settleAmount = Math.min(creditor.amount, debtor.amount);

    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: parseFloat(settleAmount.toFixed(2)),
    });

    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return transactions; // array of { from, to, amount }
};

module.exports = { simplifyDebts };
