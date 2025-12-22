import express from 'express';
import Url from '../models/Url.js';
import Click from '../models/Click.js';
import auth from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadImage, deleteImage } from '../utils/cloudinary.js';

const router = express.Router();

/**
 * GET /api/urls
 * Get all URLs for the authenticated user with pagination and search
 * Query params: page (default 1), limit (default 10), search (optional)
 */
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build query filter
    const filter = { userId: req.user._id };
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    // Get total count for pagination
    const total = await Url.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Get paginated URLs
    const urls = await Url.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: urls.map(url => ({
        id: url._id,
        user_id: url.userId,
        title: url.title,
        original_url: url.originalUrl,
        short_url: url.shortUrl,
        custom_url: url.customUrl,
        qr: url.qr,
        created_at: url.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get URLs error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching URLs'
    });
  }
});

/**
 * GET /api/urls/:id
 * Get a single URL by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const url = await Url.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: url._id,
        user_id: url.userId,
        title: url.title,
        original_url: url.originalUrl,
        short_url: url.shortUrl,
        custom_url: url.customUrl,
        qr: url.qr,
        created_at: url.createdAt
      }
    });
  } catch (error) {
    console.error('Get URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching URL'
    });
  }
});

/**
 * POST /api/urls
 * Create a new short URL
 */
router.post('/', auth, upload.single('qrCode'), async (req, res) => {
  try {
    const { title, longUrl, customUrl } = req.body;

    // Generate short URL
    const shortUrl = Math.random().toString(36).substr(2, 6);

    // Check if custom URL is taken
    if (customUrl) {
      const existing = await Url.findOne({ 
        $or: [{ customUrl }, { shortUrl: customUrl }] 
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Custom URL is already taken'
        });
      }
    }

    // Upload QR code to Cloudinary
    let qrData = { url: '', publicId: '' };
    if (req.file) {
      qrData = await uploadImage(req.file.buffer, 'qr_codes');
    }

    // Create URL
    const url = await Url.create({
      userId: req.user._id,
      title,
      originalUrl: longUrl,
      shortUrl,
      customUrl: customUrl || null,
      qr: qrData.url,
      qrPublicId: qrData.publicId
    });

    res.status(201).json({
      success: true,
      data: [{
        id: url._id,
        user_id: url.userId,
        title: url.title,
        original_url: url.originalUrl,
        short_url: url.shortUrl,
        custom_url: url.customUrl,
        qr: url.qr,
        created_at: url.createdAt
      }]
    });
  } catch (error) {
    console.error('Create URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating short URL'
    });
  }
});

/**
 * DELETE /api/urls/:id
 * Delete a URL and its QR code from Cloudinary
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const url = await Url.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found'
      });
    }

    // Delete QR code from Cloudinary
    if (url.qrPublicId) {
      await deleteImage(url.qrPublicId);
    }

    // Delete associated clicks
    await Click.deleteMany({ urlId: url._id });

    // Delete URL
    await url.deleteOne();

    res.json({
      success: true,
      message: 'URL deleted successfully'
    });
  } catch (error) {
    console.error('Delete URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting URL'
    });
  }
});

export default router;
