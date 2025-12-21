import mongoose from 'mongoose';

const urlSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required']
  },
  shortUrl: {
    type: String,
    required: true,
    unique: true
  },
  customUrl: {
    type: String,
    default: null,
    sparse: true // Allows null values while maintaining uniqueness
  },
  qr: {
    type: String,
    default: ''
  },
  qrPublicId: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster lookups
urlSchema.index({ shortUrl: 1 });
urlSchema.index({ customUrl: 1 });
urlSchema.index({ userId: 1 });

const Url = mongoose.model('Url', urlSchema);

export default Url;
