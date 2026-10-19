const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: '' },
    // Peer balances: userId -> net amount (positive = they owe you, negative = you owe them)
    balances: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notifications: [
      {
        message: String,
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        type: { type: String, enum: ['expense', 'settlement', 'group', 'system'], default: 'system' },
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
