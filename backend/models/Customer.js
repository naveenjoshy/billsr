import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  type: { type: String },
  name: { type: String, required: true, trim: true },
  address: { type: String },
  customer_photo_url: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  shop_name: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  shop_photo_url: { type: String },
  audit_trail: {
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    modified_at: { type: Date, default: Date.now },
    modified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

// Spatial index initialization for handling neighborhood map boundaries
CustomerSchema.index({ location: '2dsphere' });

export const Customer = mongoose.model('Customer', CustomerSchema);
