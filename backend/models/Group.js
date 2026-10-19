const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '🏠' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Using Mixed instead of Map<Map> to avoid Mongoose serialization issues
    // Structure: { "userId": { "otherUserId": amount } }
    groupBalances: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

groupSchema.index({ members: 1, createdAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
