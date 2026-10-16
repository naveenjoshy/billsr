import mongoose from 'mongoose';

const SchemeSchema = new mongoose.Schema({
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  scheme_name: { type: String, required: true, trim: true },
  scheme_description: { type: String },
  status: { type: String, required: true, enum: ['A', 'S'], default: 'A' }, // 'A'ctive, 'S'uspended
  permitted_operation: { type: String, required: true, enum: ['A', 'S'], default: 'A' },
  receipt_config: {
    fields: [{
      field_name: { type: String, required: true },
      data_type: { type: String, required: true },
      is_mandatory: { type: Boolean, default: false },
      print_order: { type: Number }
    }]
  }
});

export const Scheme = mongoose.model('Scheme', SchemeSchema);
