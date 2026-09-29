import { Router } from 'express';
import { 
  getKanban, 
  getEscalations, 
  getTeamPerformance,
  getCustomerProgress,
  reassignRole,
  getReports
} from '../controllers/project-head.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();
const phAuth = [authenticate, authorize(UserRole.PROJECT_HEAD, UserRole.ADMIN)];

router.get('/kanban', ...phAuth, getKanban);
router.get('/escalations', ...phAuth, getEscalations);
router.get('/team-performance', ...phAuth, getTeamPerformance);
router.get('/customer/:id/progress', ...phAuth, getCustomerProgress);
router.post('/reassign', ...phAuth, reassignRole);
router.get('/reports', ...phAuth, getReports);

export default router;
