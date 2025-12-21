import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// OTP expires in 10 minutes (600 seconds)
const OTP_EXPIRY = 600;

/**
 * Store OTP in Redis with 10-minute expiry
 * @param {string} email - User email
 * @param {string} otp - The OTP code
 */
export const storeOtp = async (email, otp) => {
  const key = `otp:${email}`;
  await redis.setex(key, OTP_EXPIRY, otp);
};

/**
 * Get OTP from Redis
 * @param {string} email - User email
 * @returns {Promise<string|null>}
 */
export const getOtp = async (email) => {
  const key = `otp:${email}`;
  return await redis.get(key);
};

/**
 * Delete OTP from Redis
 * @param {string} email - User email
 */
export const deleteOtp = async (email) => {
  const key = `otp:${email}`;
  await redis.del(key);
};

/**
 * Generate a 6-digit OTP
 * @returns {string}
 */
export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Rate limiter for OTP APIs - 5 requests per minute
export const otpRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'ratelimit:otp'
});

export default redis;
