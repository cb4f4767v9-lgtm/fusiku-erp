import rateLimit from 'express-rate-limit';

/**
 * Strict per-IP limit for tenant signup (independent of global API limiter).
 * Defaults: 8 signups per hour per IP (tunable via env).
 */
export const signupRateLimiter = rateLimit({
  windowMs: parseInt(process.env.SIGNUP_RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000), 10),
  max: parseInt(process.env.SIGNUP_RATE_LIMIT_MAX || '8', 10),
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
