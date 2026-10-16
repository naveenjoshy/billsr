import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  address: { type: String, required: true },
  phone_no: { type: String, required: true },
  agent_photo_url: { type: String },
  agent_id_url: { type: String },
  agent_id_number: { type: String },
  agent_id_type: { type: String },
  password_reset_flag: { type: Boolean, default: true },
  last_password_change_date: { type: Date },
  cash_holding_limit: { type: mongoose.Schema.Types.Decimal128, required: true },
  cash_holding_days: { type: Number, required: true }, // Representing integer parameters
  audit_trail: {
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modified_at: { type: Date, default: Date.now },
    modified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

export const Agent = mongoose.model('Agent', AgentSchema);
