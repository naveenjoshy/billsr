import mongoose from 'mongoose';

const CustomerSchemeSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  scheme_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme', required: true },
  scheme_opening_amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  monthly_target: { type: mongoose.Schema.Types.Decimal128 },
  remittance_periodicity: { type: String, required: true, enum: ['D', 'W', 'A', 'M', 'N'] }, // [D]aily, [W]eekly...
  audit_trail: {
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modified_at: { type: Date, default: Date.now },
    modified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

// Prevents a customer from being enrolled in the exact same scheme profile multiple times
CustomerSchemeSchema.index({ customer_id: 1, scheme_id: 1 }, { unique: true });

export const CustomerScheme = mongoose.model('CustomerScheme', CustomerSchemeSchema);
