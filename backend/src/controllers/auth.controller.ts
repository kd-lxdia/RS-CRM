import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { JwtPayload, LoginResponse, RefreshResponse, UserRole } from '@slar-crm/shared';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

// Security: Use the same JWT_SECRET validation as jwt.ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Application cannot start.');
}

const fallbackRefreshTokens = new Map<string, string>();

let redis: Redis | null = null;
if (process.env.DISABLE_REDIS !== 'true') {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
  });
  redis.connect().catch(() => {
    console.warn('[Auth] Redis connection failed, using in-memory fallback for refresh tokens');
    redis = null;
  });
}

async function setRefreshToken(userId: string, refreshToken: string) {
  if (redis) {
    try {
      await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
      return;
    } catch {
      redis = null;
    }
  }
  fallbackRefreshTokens.set(userId, refreshToken);
}

async function getRefreshToken(userId: string) {
  if (redis) {
    try {
      return await redis.get(`refresh_token:${userId}`);
    } catch {
      redis = null;
    }
  }
  return fallbackRefreshTokens.get(userId) ?? null;
}

async function deleteRefreshToken(userId: string) {
  if (redis) {
    try {
      await redis.del(`refresh_token:${userId}`);
    } catch {
      redis = null;
    }
  }
  fallbackRefreshTokens.delete(userId);
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email and password are required' } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const payload: JwtPayload = {
      id: user.id,
      role: user.role as unknown as UserRole,
      dealerId: user.dealerId,
      zoneId: user.zoneId,
      name: user.name,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();

    // Store refresh token in Redis with 7 days expiry (604800 seconds)
    await setRefreshToken(user.id, refreshToken);

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const response: LoginResponse = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role as unknown as UserRole,
        name: user.name,
        dealerId: user.dealerId,
        zoneId: user.zoneId
      }
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token || !refreshToken) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing tokens' } });
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as JwtPayload;
    } catch (err) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid access token' } });
    }

    const storedHash = await getRefreshToken(payload.id);
    if (storedHash !== refreshToken) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
    }

    // Issue new tokens. Strip JWT registered claims (iat/exp/nbf) from the
    // decoded payload before re-signing, otherwise jsonwebtoken throws
    // "Bad options.expiresIn: the payload already has an exp property".
    const { iat, exp, nbf, ...cleanPayload } = payload as JwtPayload & { iat?: number; exp?: number; nbf?: number };
    const newAccessToken = generateAccessToken(cleanPayload);
    const newRefreshToken = generateRefreshToken();

    await setRefreshToken(payload.id, newRefreshToken);

    const response: RefreshResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.id) {
      await deleteRefreshToken(req.user.id);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
