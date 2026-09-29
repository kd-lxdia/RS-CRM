import { Router } from 'express';
import { getMyCustomers, completeInstallation, getMyRoute, completeSite } from '../controllers/installation.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.get('/my-customers', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), getMyCustomers);
router.get('/my-route', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), getMyRoute);
router.post('/:customerId/complete', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), completeInstallation);
router.post('/:siteId/complete', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), completeSite);

export default router;
