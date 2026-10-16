import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  collection_name: { type: String, required: true },
  document_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  description: { type: String, required: true },
  changed_field: { type: String },
  previous_value: { type: mongoose.Schema.Types.Mixed },
  new_value: { type: mongoose.Schema.Types.Mixed },
  updated_date: { type: Date, default: Date.now },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
