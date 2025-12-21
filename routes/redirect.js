import express from 'express';
import Url from '../models/Url.js';
import Click from '../models/Click.js';

const router = express.Router();

/**
 * Parse device type from user agent
 */
const getDeviceType = (userAgent) => {
  if (!userAgent) return 'desktop';
  userAgent = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(userAgent)) {
    return 'tablet';
  }
  return 'desktop';
};

/**
 * Parse browser from user agent
 */
const getBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'Internet Explorer';
  return 'Other';
};

/**
 * Parse OS from user agent
 */
const getOS = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Windows NT 10')) return 'Windows 10';
  if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (userAgent.includes('Windows NT 6.2')) return 'Windows 8';
  if (userAgent.includes('Windows NT 6.1')) return 'Windows 7';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return 'Other';
};

/**
 * Get IP address from request
 */
const getClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'Unknown';
};

/**
 * Fetch geolocation from IP using free API
 */
const getGeolocation = async (ip) => {
  try {
    // Skip localhost IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { city: 'Local', country: 'Local', region: 'Local' };
    }

    // Use ip-api.com (free, no API key needed, 45 requests/minute)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        city: data.city || 'Unknown',
        country: data.country || 'Unknown',
        region: data.regionName || 'Unknown'
      };
    }

    return { city: 'Unknown', country: 'Unknown', region: 'Unknown' };
  } catch (error) {
    console.error('Geolocation error:', error);
    return { city: 'Unknown', country: 'Unknown', region: 'Unknown' };
  }
};

/**
 * GET /:shortCode
 * Redirect to original URL with click tracking
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
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#18181b;color:#fff;">
            <div style="text-align:center;">
              <h1 style="font-size:3rem;margin-bottom:1rem;">404</h1>
              <p style="color:#a1a1aa;">Short link not found</p>
            </div>
          </body>
        </html>
      `);
    }

    // Get client info
    const userAgent = req.headers['user-agent'] || '';
    const ip = getClientIP(req);
    const referer = req.headers['referer'] || 'Direct';
    const device = getDeviceType(userAgent);
    const browser = getBrowser(userAgent);
    const os = getOS(userAgent);

    // Get geolocation (async, don't await - log click first)
    getGeolocation(ip).then(async (geo) => {
      try {
        await Click.create({
          urlId: url._id,
          ip: ip,
          city: geo.city,
          country: geo.country,
          region: geo.region,
          device: device,
          browser: browser,
          os: os,
          referer: referer
        });
      } catch (clickError) {
        console.error('Error saving click:', clickError);
      }
    });

    // Perform actual HTTP 302 redirect immediately
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
