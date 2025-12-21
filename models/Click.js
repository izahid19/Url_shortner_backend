import mongoose from 'mongoose';

const clickSchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Url',
    required: true
  },
  // Location info
  city: {
    type: String,
    default: 'Unknown'
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  region: {
    type: String,
    default: 'Unknown'
  },
  // Device info
  device: {
    type: String,
    default: 'desktop'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  os: {
    type: String,
    default: 'Unknown'
  },
  // Network info
  ip: {
    type: String,
    default: 'Unknown'
  },
  // Referrer info
  referer: {
    type: String,
    default: 'Direct'
  },
  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups by URL
clickSchema.index({ urlId: 1 });
clickSchema.index({ createdAt: -1 });

const Click = mongoose.model('Click', clickSchema);

export default Click;
