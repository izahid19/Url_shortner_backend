import dotenv from 'dotenv';

dotenv.config();

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send OTP email using Brevo API
 * @param {string} email - Recipient email
 * @param {string} otp - The OTP code
 * @param {string} type - 'verify' for account verification, 'reset' for password reset
 */
export const sendOtpEmail = async (email, otp, type = 'verify') => {
  const subject = type === 'verify' 
    ? 'Verify Your Trimmmr Account' 
    : 'Reset Your Trimmmr Password';
  
  const htmlContent = type === 'verify' 
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #3B82F6; text-align: center;">Welcome to Trimmmr!</h1>
        <p style="font-size: 16px; color: #333;">Thank you for signing up. Please verify your email address using the code below:</p>
        <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <h2 style="color: white; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h2>
        </div>
        <p style="font-size: 14px; color: #666;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 14px; color: #666;">If you didn't create an account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Trimmmr. All rights reserved.</p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #EF4444; text-align: center;">Password Reset Request</h1>
        <p style="font-size: 16px; color: #333;">You requested to reset your password. Use the code below to proceed:</p>
        <div style="background: linear-gradient(135deg, #EF4444, #F97316); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <h2 style="color: white; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h2>
        </div>
        <p style="font-size: 14px; color: #666;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email or contact support.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Trimmmr. All rights reserved.</p>
      </div>
    `;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || process.env.FROM_NAME,
        email: process.env.BREVO_SENDER_EMAIL || process.env.FROM_EMAIL
      },
      to: [{ email }],
      subject,
      htmlContent
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Brevo API Error:', error);
    throw new Error('Failed to send email');
  }

  return await response.json();
};
