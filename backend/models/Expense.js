const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0.01 },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    splitType: {
      type: String,
      enum: ['EQUAL', 'EXACT', 'PERCENTAGE'],
      default: 'EQUAL',
    },
    splits: [splitSchema],
    category: {
      type: String,
      enum: ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'],
      default: 'other',
    },
    receiptImage: { type: String, default: null },
    receiptItems: [
      {
        name: String,
        price: Number,
        quantity: { type: Number, default: 1 },
      },
    ],
    notes: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    isSettlement: { type: Boolean, default: false },
    // Optimistic concurrency control
    __v: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for efficient group expense queries
expenseSchema.index({ groupId: 1, createdAt: -1 });
expenseSchema.index({ paidBy: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
