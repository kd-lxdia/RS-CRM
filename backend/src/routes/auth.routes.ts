import { Router } from 'express';
import { body } from 'express-validator';
import { login, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().isString(),
  validate
], login);

router.post('/refresh', authLimiter, [
  body('refreshToken').notEmpty().isString(),
  validate
], refresh);

router.post('/logout', authenticate, logout);

export default router;
