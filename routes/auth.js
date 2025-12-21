import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import rateLimiter from '../middleware/rateLimiter.js';
import upload from '../middleware/upload.js';
import { uploadImage, deleteImage } from '../utils/cloudinary.js';
import { storeOtp, getOtp, deleteOtp, generateOtp } from '../utils/redis.js';
import { sendOtpEmail } from '../utils/email.js';

const router = express.Router();

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * POST /api/auth/signup
 * Register a new user and send verification OTP
 */
router.post('/signup', rateLimiter, upload.single('profilePic'), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Upload profile picture to Cloudinary
    let profilePicData = { url: '', publicId: '' };
    if (req.file) {
      profilePicData = await uploadImage(req.file.buffer, 'profile_pics');
    } else if (req.body.profilePic && typeof req.body.profilePic === 'string') {
      profilePicData.url = req.body.profilePic;
    }

    // Create user (unverified)
    const user = await User.create({
      name,
      email,
      password,
      profilePic: profilePicData.url,
      profilePicPublicId: profilePicData.publicId,
      isVerified: false
    });

    // Generate and store OTP
    const otp = generateOtp();
    await storeOtp(email, otp);

    // Send verification email
    await sendOtpEmail(email, otp, 'verify');

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for verification code.',
      email: user.email
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating account'
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with OTP
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Get stored OTP
    const storedOtp = await getOtp(email);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new one.'
      });
    }

    if (String(storedOtp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Mark user as verified
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete OTP
    await deleteOtp(email);

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        role: 'authenticated'
      }
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error verifying email'
    });
  }
});

/**
 * POST /api/auth/resend-otp
 * Resend verification OTP
 */
router.post('/resend-otp', rateLimiter, async (req, res) => {
  try {
    const { email, type = 'verify' } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate and store new OTP
    const otp = generateOtp();
    await storeOtp(email, otp);

    // Send OTP email
    await sendOtpEmail(email, otp, type);

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error sending OTP'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email first',
        needsVerification: true,
        email: user.email
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        role: 'authenticated'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error logging in'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        profilePic: req.user.profilePic,
        role: 'authenticated'
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting user'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset OTP
 */
router.post('/forgot-password', rateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a reset code.'
      });
    }

    // Generate and store OTP
    const otp = generateOtp();
    await storeOtp(email, otp);

    // Send reset email
    await sendOtpEmail(email, otp, 'reset');

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a reset code.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with OTP
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Get stored OTP
    const storedOtp = await getOtp(email);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new one.'
      });
    }

    if (String(storedOtp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    // Delete OTP
    await deleteOtp(email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error resetting password'
    });
  }
});

/**
 * PUT /api/auth/update-profile
 * Update user profile (deletes old profile pic from Cloudinary)
 */
router.put('/update-profile', auth, upload.single('profilePic'), async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = {};

    if (name) updateData.name = name;

    // Handle profile picture update
    if (req.file) {
      // Delete old profile picture from Cloudinary
      if (req.user.profilePicPublicId) {
        await deleteImage(req.user.profilePicPublicId);
      }

      // Upload new profile picture
      const profilePicData = await uploadImage(req.file.buffer, 'profile_pics');
      updateData.profilePic = profilePicData.url;
      updateData.profilePicPublicId = profilePicData.publicId;
    } else if (req.body.profilePic && typeof req.body.profilePic === 'string') {
       // If a URL string is provided
       // If the previous image was hosted on Cloudinary, delete it
       if (req.user.profilePicPublicId) {
         await deleteImage(req.user.profilePicPublicId);
       }
       
       updateData.profilePic = req.body.profilePic;
       updateData.profilePicPublicId = null; // Clear public ID as it's an external URL
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true });

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        role: 'authenticated'
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating profile'
    });
  }
});

export default router;
