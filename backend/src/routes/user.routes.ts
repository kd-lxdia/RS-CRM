import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import { listUsers, updateUserPreferences, getUserPreferences } from '../controllers/user.controller';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN, UserRole.PROJECT_HEAD),
  listUsers
);

router.get(
  '/me/preferences',
  authenticate,
  getUserPreferences
);

router.put(
  '/me/preferences',
  authenticate,
  updateUserPreferences
);

export default router;
