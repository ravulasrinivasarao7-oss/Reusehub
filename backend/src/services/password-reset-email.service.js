import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function assertPasswordResetEmailConfigured() {
  if (!env.resendApiKey || !env.emailFrom) {
    console.error('Password reset email is not configured: set RESEND_API_KEY and EMAIL_FROM.');
    throw new AppError(503, 'Password reset is temporarily unavailable. Please try again later.');
  }
}

export async function sendPasswordResetEmail(email, token) {
  assertPasswordResetEmailConfigured();

  const resetUrl = new URL('/reset-password', `${env.frontendOrigins[0]}/`);
  resetUrl.searchParams.set('token', token);

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: env.emailFrom,
        to: [email],
        subject: 'Reset your ReUseHub password',
        text: `Use this link to reset your ReUseHub password. It expires in 30 minutes:\n\n${resetUrl.href}\n\nIf you did not request a password reset, you can ignore this email.`,
        html: `<p>Use the link below to reset your ReUseHub password. It expires in 30 minutes.</p><p><a href="${resetUrl.href}">Reset your password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`,
      }),
    });
  } catch (error) {
    console.error('Password reset email delivery failed:', error.name);
    throw new AppError(503, 'Password reset is temporarily unavailable. Please try again later.');
  }

  if (!response.ok) {
    console.error('Password reset email delivery failed:', response.status);
    throw new AppError(503, 'Password reset is temporarily unavailable. Please try again later.');
  }
}
