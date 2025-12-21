import express from 'express';
import Click from '../models/Click.js';
import Url from '../models/Url.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/clicks/:urlId
 * Get clicks for a specific URL
 */
router.get('/:urlId', auth, async (req, res) => {
  try {
    // Verify the URL belongs to the user
    const url = await Url.findOne({ 
      _id: req.params.urlId, 
      userId: req.user._id 
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found'
      });
    }

    const clicks = await Click.find({ urlId: req.params.urlId });

    res.json({
      success: true,
      data: clicks.map(click => ({
        id: click._id,
        url_id: click.urlId,
        city: click.city,
        country: click.country,
        device: click.device,
        created_at: click.createdAt
      }))
    });
  } catch (error) {
    console.error('Get clicks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching clicks'
    });
  }
});

/**
 * POST /api/clicks/multiple
 * Get clicks for multiple URLs
 */
router.post('/multiple', auth, async (req, res) => {
  try {
    const { urlIds } = req.body;

    if (!urlIds || !Array.isArray(urlIds)) {
      return res.status(400).json({
        success: false,
        message: 'URL IDs array is required'
      });
    }

    // Verify all URLs belong to the user
    const urls = await Url.find({ 
      _id: { $in: urlIds }, 
      userId: req.user._id 
    });

    const validUrlIds = urls.map(u => u._id);

    const clicks = await Click.find({ urlId: { $in: validUrlIds } });

    res.json({
      success: true,
      data: clicks.map(click => ({
        id: click._id,
        url_id: click.urlId,
        city: click.city,
        country: click.country,
        device: click.device,
        created_at: click.createdAt
      }))
    });
  } catch (error) {
    console.error('Get multiple clicks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching clicks'
    });
  }
});

/**
 * POST /api/clicks
 * Store a click (public endpoint - called during redirect)
 */
router.post('/', async (req, res) => {
  try {
    const { urlId, city, country, device } = req.body;

    const click = await Click.create({
      urlId,
      city: city || 'Unknown',
      country: country || 'Unknown',
      device: device || 'desktop'
    });

    res.status(201).json({
      success: true,
      data: {
        id: click._id,
        url_id: click.urlId,
        city: click.city,
        country: click.country,
        device: click.device,
        created_at: click.createdAt
      }
    });
  } catch (error) {
    console.error('Store click error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error storing click'
    });
  }
});

export default router;
