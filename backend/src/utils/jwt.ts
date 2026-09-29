import jwt from 'jsonwebtoken';
import { JwtPayload } from '@slar-crm/shared';
import crypto from 'crypto';

// Security: Require JWT_SECRET to be set, fail fast if missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Application cannot start.');
}

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};
