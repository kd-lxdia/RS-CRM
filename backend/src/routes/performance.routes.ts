import { Router } from 'express';
import { performanceController } from '../controllers/performance.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.use(authenticate);

// My own metrics
router.get('/me', performanceController.getMyMetrics.bind(performanceController));

// User metrics (admin/project head can view any user)
router.get(
  '/users/:userId',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  performanceController.getUserMetrics.bind(performanceController)
);

// User performance history
router.get(
  '/users/:userId/history',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  performanceController.getPerformanceHistory.bind(performanceController)
);

// Trigger snapshot
router.post(
  '/users/:userId/snapshot',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  performanceController.triggerSnapshot.bind(performanceController)
);

// Team performance
router.get(
  '/team/:supervisorId',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  performanceController.getTeamPerformance.bind(performanceController)
);

// Performance alerts
router.get(
  '/team/:supervisorId/alerts',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  performanceController.getPerformanceAlerts.bind(performanceController)
);

export default router;
