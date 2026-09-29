import { Router } from 'express';
import { 
  getUsers, createUser, updateUser, deleteUser, resetPassword,
  getDealers, createDealer,
  getConfig, getAudit, getHealth
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();
const adminAuth = [authenticate, authorize(UserRole.ADMIN)];

// Users
router.get('/users', ...adminAuth, getUsers);
router.post('/users', ...adminAuth, createUser);
router.put('/users/:id', ...adminAuth, updateUser);
router.delete('/users/:id', ...adminAuth, deleteUser);
router.post('/users/:id/reset-password', ...adminAuth, resetPassword);

// Dealers
router.get('/dealers', ...adminAuth, getDealers);
router.post('/dealers', ...adminAuth, createDealer);

// System
router.get('/config', ...adminAuth, getConfig);
router.get('/audit', ...adminAuth, getAudit);
router.get('/health', ...adminAuth, getHealth);

export default router;
