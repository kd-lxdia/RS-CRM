import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  getCustomerPayments,
  recordPayment,
  updatePayment,
} from '../controllers/payment.controller';
import { validatePayment, validateUuidParam } from '../middlewares/validation';
import { paymentLimiter } from '../middlewares/rateLimiter';

const router = Router();
router.use(authenticate);
router.use(paymentLimiter);

router.get('/customer/:customerId', validateUuidParam('customerId'), getCustomerPayments);
router.post('/', validatePayment, recordPayment);
router.put('/:id', validateUuidParam('id'), authorize(UserRole.ADMIN, UserRole.ACCOUNTANT), updatePayment);

export default router;
