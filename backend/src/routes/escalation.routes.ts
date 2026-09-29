import { Router } from 'express';
import { escalationController } from '../controllers/escalation.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.use(authenticate);

// Get escalation logs
router.get('/', escalationController.getEscalationLogs.bind(escalationController));

// Trigger escalation check (admin only)
router.post(
  '/check',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  escalationController.checkEscalations.bind(escalationController)
);

// Manually escalate a task
router.post(
  '/tasks/:taskId',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  escalationController.escalateTask.bind(escalationController)
);

// Acknowledge escalation
router.patch('/:id/acknowledge', escalationController.acknowledgeEscalation.bind(escalationController));

// Resolve escalation
router.patch('/:id/resolve', escalationController.resolveEscalation.bind(escalationController));

// Get/update escalation rules (admin only)
router.get(
  '/rules',
  authorize(UserRole.ADMIN),
  escalationController.getEscalationRules.bind(escalationController)
);

router.put(
  '/rules',
  authorize(UserRole.ADMIN),
  escalationController.updateEscalationRules.bind(escalationController)
);

export default router;
