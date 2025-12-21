import { otpRateLimiter } from '../utils/redis.js';

/**
 * Rate limiter middleware for OTP APIs
 * Limits to 5 requests per minute per IP
 */
const rateLimiter = async (req, res, next) => {
  try {
    // Use IP address or email as identifier
    const identifier = req.body.email || req.ip;
    
    const { success, limit, remaining, reset } = await otpRateLimiter.limit(identifier);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000)
      });
    }

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // If rate limiter fails, allow the request to proceed
    next();
  }
};

export default rateLimiter;
