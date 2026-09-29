import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log full error details server-side
  winston.error(err.message, { 
    stack: err.stack, 
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id 
  });
  
  const statusCode = err.statusCode || 500;
  
  // Security: Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode === 500 
    ? 'An internal error occurred. Please try again later.'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      // Only include stack trace in development
      ...((!isProduction && err.stack) && { stack: err.stack })
    }
  });
};
