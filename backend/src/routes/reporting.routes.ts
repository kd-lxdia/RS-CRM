import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import { getSnapshot, getAiReport, getReportHistory } from '../controllers/reporting.controller';

const router = Router();
router.use(authenticate);

// Business reporting is for owners/managers only.
const reportAuth = authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.DEALER_ADMIN);

router.get('/snapshot', reportAuth, getSnapshot);
router.post('/ai', reportAuth, getAiReport);
router.get('/history', reportAuth, getReportHistory);

export default router;
