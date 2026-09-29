import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '@slar-crm/shared';

// Security: Use the same JWT_SECRET validation as jwt.ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Application cannot start.');
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    // Provide more specific error messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired. Please refresh.' } 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Invalid token format.' } 
      });
    }
    return res.status(401).json({ 
      success: false, 
      error: { code: 'UNAUTHORIZED', message: 'Authentication failed.' } 
    });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
};

export const dealerScope = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.dealerId) {
    if (req.method === 'GET') {
      req.query.dealerId = req.user.dealerId;
    } else if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.body.dealerId = req.user.dealerId;
    }
  }
  next();
};

// Backwards-compatible aliases for older code expecting these names
export const protect = authenticate;
export const restrictTo = (...roles: UserRole[]) => authorize(...roles);
