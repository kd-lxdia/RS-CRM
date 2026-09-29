import rateLimit from 'express-rate-limit';

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skip: () => process.env.NODE_ENV === 'development',
  message: { 
    success: false, 
    error: { 
      code: 'TOO_MANY_REQUESTS', 
      message: 'Too many authentication attempts. Please try again in 15 minutes.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiting for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { 
    success: false, 
    error: { 
      code: 'TOO_MANY_REQUESTS', 
      message: 'Too many API requests. Please slow down.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: { 
    success: false, 
    error: { 
      code: 'TOO_MANY_UPLOADS', 
      message: 'Too many file uploads. Please wait before uploading more files.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for payment operations
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 payment operations per minute
  message: { 
    success: false, 
    error: { 
      code: 'TOO_MANY_REQUESTS', 
      message: 'Too many payment requests. Please try again shortly.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for chatbot (prevent abuse)
export const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { 
    success: false, 
    error: { 
      code: 'TOO_MANY_MESSAGES', 
      message: 'Too many messages. Please slow down.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
});
