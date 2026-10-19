/**
 * Split Calculator - Strategy Pattern (translated from C++ SplitwiseApp.cpp)
 * 
 * Implements EqualSplit, ExactSplit, PercentageSplit strategies
 * via a SplitFactory just like the C++ design.
 */

/**
 * EQUAL: Divide totalAmount equally among all users
 */
const calculateEqualSplit = (totalAmount, userIds) => {
  const amountPerUser = totalAmount / userIds.length;
  return userIds.map((userId) => ({
    userId,
    amount: parseFloat(amountPerUser.toFixed(2)),
  }));
};

/**
 * EXACT: Each user pays an exact specified amount (values must sum to totalAmount)
 */
const calculateExactSplit = (totalAmount, userIds, values) => {
  if (!values || values.length !== userIds.length) {
    throw new Error('Exact split requires values for each user');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - totalAmount) > 0.01) {
    throw new Error(`Exact split values (${sum}) must sum to total amount (${totalAmount})`);
  }
  return userIds.map((userId, i) => ({
    userId,
    amount: parseFloat(values[i].toFixed(2)),
  }));
};

/**
 * PERCENTAGE: Each user pays a percentage of the total (values must sum to 100)
 */
const calculatePercentageSplit = (totalAmount, userIds, values) => {
  if (!values || values.length !== userIds.length) {
    throw new Error('Percentage split requires percentage values for each user');
  }
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Percentage values must sum to 100, got ${sum}`);
  }
  return userIds.map((userId, i) => ({
    userId,
    amount: parseFloat(((totalAmount * values[i]) / 100).toFixed(2)),
  }));
};

/**
 * SplitFactory: returns the correct strategy based on splitType
 */
const calculateSplit = (totalAmount, userIds, splitType, values = []) => {
  switch (splitType) {
    case 'EQUAL':
      return calculateEqualSplit(totalAmount, userIds);
    case 'EXACT':
      return calculateExactSplit(totalAmount, userIds, values);
    case 'PERCENTAGE':
      return calculatePercentageSplit(totalAmount, userIds, values);
    default:
      return calculateEqualSplit(totalAmount, userIds);
  }
};

module.exports = { calculateSplit };
