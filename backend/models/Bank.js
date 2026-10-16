import mongoose from 'mongoose';

const BankSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bank_name: { type: String, required: true, trim: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  name_ceo: { type: String },
  designation: { type: String },
  license_expiry: { type: Date, required: true },
  compliance_status: {
    account_status: { type: String, required: true, enum: ['Active', 'Grace', 'Suspended'], default: 'Active' },
    grace_period_end: { type: Date },
    last_renewal_reminder_sent: { type: Date }
  },
  audit_trail: {
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modified_at: { type: Date, default: Date.now },
    modified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

export const Bank = mongoose.model('Bank', BankSchema);
