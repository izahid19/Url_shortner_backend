import express from 'express';
import Url from '../models/Url.js';

const router = express.Router();

/**
 * GET /:shortCode
 * Redirect to original URL
 */
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Skip API routes
    if (shortCode === 'api') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Find URL by short_url or custom_url
    const url = await Url.findOne({
      $or: [
        { shortUrl: shortCode },
        { customUrl: shortCode }
      ]
    });

    if (!url) {
      return res.status(404).send(`
        <html>
          <head><title>Link Not Found</title></head>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
            <h1>Short link not found</h1>
          </body>
        </html>
      `);
    }

    // Perform actual HTTP 302 redirect
    res.redirect(302, url.originalUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Error processing redirect');
  }
});

/**
 * GET /api/lookup/:shortCode
 * Lookup URL and return JSON (for frontend redirect with click tracking)
 */
router.get('/api/lookup/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const url = await Url.findOne({
      $or: [
        { shortUrl: shortCode },
        { customUrl: shortCode }
      ]
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short link not found'
      });
    }

    // Return JSON for frontend to handle redirect with click tracking
    res.json({
      success: true,
      data: {
        id: url._id,
        original_url: url.originalUrl
      }
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error looking up URL'
    });
  }
});

export default router;
