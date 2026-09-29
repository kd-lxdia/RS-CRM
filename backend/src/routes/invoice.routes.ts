import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  handleCloseDeal,
  getInvoice,
  getCustomerInvoices,
  sendInvoice,
  downloadInvoicePDF,
} from '../controllers/invoice.controller';

const router = Router();
router.use(authenticate);

// Deal close (salesperson / admin)
router.post('/close-deal', authorize(UserRole.SALESPERSON, UserRole.ADMIN, UserRole.PROJECT_HEAD), handleCloseDeal);

// Invoice management
router.get('/customer/:customerId', getCustomerInvoices);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadInvoicePDF);
router.post('/:id/send', sendInvoice);

export default router;
