import { Router } from 'express';
import { getMyCustomers, getChecklist, updateChecklist } from '../controllers/documentation.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

// /api/documentation/...
router.get(
  '/my-customers',
  authenticate,
  authorize(UserRole.DOCUMENTATION, UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getMyCustomers
);

router.get(
  '/checklist/:customerId',
  authenticate,
  authorize(UserRole.DOCUMENTATION, UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getChecklist
);

router.patch(
  '/checklist/:customerId',
  authenticate,
  authorize(UserRole.DOCUMENTATION, UserRole.ADMIN, UserRole.PROJECT_HEAD),
  updateChecklist
);

export default router;
