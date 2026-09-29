import { Router } from 'express';
import { 
  getStock, 
  createStockItem, 
  updateStockItem, 
  createTransaction,
  getPipeline,
  dispatchCustomer,
  getAlerts 
} from '../controllers/warehouse.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

// Define role-specific middleware array for brevity
const warehouseAuth = [authenticate, authorize(UserRole.WAREHOUSE, UserRole.ADMIN, UserRole.PROJECT_HEAD)];

// STOCK ENDPOINTS
router.get('/stock', ...warehouseAuth, getStock);
router.post('/stock', ...warehouseAuth, createStockItem);
router.put('/stock/:id', ...warehouseAuth, updateStockItem);
router.post('/stock/:id/transaction', ...warehouseAuth, createTransaction);

// PIPELINE ENDPOINTS
router.get('/pipeline', ...warehouseAuth, getPipeline);
router.post('/dispatch/:customerId', ...warehouseAuth, dispatchCustomer);

// ALERTS
router.get('/alerts', ...warehouseAuth, getAlerts);

export default router;
