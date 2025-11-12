/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse by limiting request rates.
 */

import rateLimit from 'express-rate-limit';
import { createComponentLogger } from '../../sidequest/logger.js';

const logger = createComponentLogger('RateLimiter');

/**
 * Standard rate limiter: 100 requests per 15 minutes
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      path: req.path,
      limit: 100
    }, 'Rate limit exceeded');

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again in 15 minutes.',
      retryAfter: 900, // seconds
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Strict rate limiter for expensive operations: 10 requests per hour
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for scan operations. Please try again later.',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      path: req.path,
      limit: 10
    }, 'Strict rate limit exceeded');

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for scan operations. Please try again in 1 hour.',
      retryAfter: 3600,
      timestamp: new Date().toISOString()
    });
  }
});
