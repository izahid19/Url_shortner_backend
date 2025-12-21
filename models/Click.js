import mongoose from 'mongoose';

const clickSchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Url',
    required: true
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  device: {
    type: String,
    default: 'desktop'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups by URL
clickSchema.index({ urlId: 1 });

const Click = mongoose.model('Click', clickSchema);

export default Click;
