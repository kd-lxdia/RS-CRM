import { Router } from 'express';
import { getBOM, updateBOMItem } from '../controllers/bom.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.get('/:customerId', authenticate, getBOM);
router.patch('/item/:id', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN, UserRole.PROJECT_HEAD), updateBOMItem);

export default router;
