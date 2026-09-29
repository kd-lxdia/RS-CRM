import { Router } from 'express';
import { 
  getSummary, 
  getReceivables, 
  getMonthlyCollection, 
  getCustomerFinancials,
  getInvoices,
  updateInvoice,
  markInvoiceOverdue,
  getPaymentsReport,
  exportPayments
} from '../controllers/finance.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const accountsRouter = Router();
const invoicesRouter = Router();
const paymentsRouter = Router();

// Shared middleware
const finAuth = [authenticate, authorize(UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.PROJECT_HEAD)];

// Accounts
accountsRouter.get('/summary', ...finAuth, getSummary);
accountsRouter.get('/receivables', ...finAuth, getReceivables);
accountsRouter.get('/monthly-collection', ...finAuth, getMonthlyCollection);
accountsRouter.get('/customer/:customerId/financial', ...finAuth, getCustomerFinancials);

// Invoices
invoicesRouter.get('/', ...finAuth, getInvoices);
invoicesRouter.patch('/:id', ...finAuth, updateInvoice);
invoicesRouter.post('/:id/mark-overdue', ...finAuth, markInvoiceOverdue);

// Payments (Report vs Export)
paymentsRouter.get('/report', ...finAuth, getPaymentsReport);
paymentsRouter.get('/export', ...finAuth, exportPayments);

// Export a single unified module attaching them internally to standard sub-paths, 
// OR export them separately. We'll export separately and mount properly in index.ts.
export { accountsRouter, invoicesRouter, paymentsRouter };
