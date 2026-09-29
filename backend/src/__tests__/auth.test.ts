import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

let testUserId: string;

beforeAll(async () => {
  // Try to clear any existing test user if DB is connected
  try {
    await prisma.user.deleteMany({ where: { email: 'testauth@slarcrm.com' } });

    const password = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'testauth@slarcrm.com',
        password,
        name: 'Test Auth',
        role: 'SALESPERSON',
        isActive: true,
      }
    });
    testUserId = user.id;
  } catch(e) {}
});

afterAll(async () => {
  try {
    if(testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
    redis.quit();
  } catch(e) {}
});

describe('Auth Endpoints', () => {
  let accessToken: string;
  let refreshToken: string;

  it('should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testauth@slarcrm.com', password: 'password123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testauth@slarcrm.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should fail when using an expired access token', async () => {
    // Generate manually expired token
    const expiredToken = jwt.sign({ id: testUserId, role: 'SALESPERSON', name: 'Test Auth', dealerId: null, zoneId: null }, process.env.JWT_SECRET || 'secret', { expiresIn: '-1s' });
    
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should refresh token successfully', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.accessToken).not.toBe(accessToken);
    
    accessToken = res.body.accessToken;
  });

  it('should fail refresh with invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken: 'invalid_token' })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should logout successfully', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Verify token is deleted from Redis
    const token = await redis.get(`refresh_token:${testUserId}`);
    expect(token).toBeNull();
  });
});
