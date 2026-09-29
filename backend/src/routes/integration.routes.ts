import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import { getConfig, putConfig, regenToken, incomingLead } from '../controllers/integration.controller';

const router = Router();

// Public webhook receiver — secured by the per-source secret token in the URL.
router.post('/incoming/:source/:token', incomingLead);

// Admin-only configuration.
router.get('/config', authenticate, authorize(UserRole.ADMIN), getConfig);
router.put('/config', authenticate, authorize(UserRole.ADMIN), putConfig);
router.post('/config/:source/regenerate-token', authenticate, authorize(UserRole.ADMIN), regenToken);

export default router;
