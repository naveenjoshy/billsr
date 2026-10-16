import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String, required: true },
  role: { type: String, required: true, enum: ['Superadmin', 'Developer', 'Bank', 'Agent'] },
  is_active: { type: Boolean, default: true },
  audit_trail: {
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now }
  }
});

UserSchema.index({ userID: 1 });
UserSchema.index({ email: 1 });

export const User = mongoose.model('User', UserSchema);
