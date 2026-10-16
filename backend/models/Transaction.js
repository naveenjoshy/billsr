import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  receipt_no: { type: String, required: true, unique: true },
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  scheme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
  transact_amt: { type: mongoose.Schema.Types.Decimal128, required: true },
  transact_type: { type: String, required: true, enum: ['D', 'W'] }, // [D]eposit, [W]ithdrawal
  transaction_status: { type: String, required: true, enum: ['A', 'C', 'P'], default: 'P' }, // [A]pproved, [C]ancelled...
  transact_mode: { type: String, required: true, enum: ['C', 'T'], default: 'C' }, // [C]ash, [T]ransfer
  balance_snapshot: {
    opening_bal: { type: mongoose.Schema.Types.Decimal128, required: true },
    new_balance: { type: mongoose.Schema.Types.Decimal128, required: true }
  },
  cancellation_info: {
    cancellation_reason: { type: String },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  collect_date: { type: Date, required: true, default: Date.now }
});

export const Transaction = mongoose.model('Transaction', TransactionSchema);
