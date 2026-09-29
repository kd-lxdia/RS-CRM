import { Router } from 'express';
import { assignDocumentation, listCustomers, getCustomerById } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.get('/', authenticate, listCustomers);
router.get('/:id', authenticate, getCustomerById);

router.patch(
  '/:id/assign-documentation',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  assignDocumentation
);

export default router;
