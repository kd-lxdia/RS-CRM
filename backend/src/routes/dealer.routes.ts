import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import * as dealerController from '../controllers/dealer.controller';

const router = Router();

// Only DEALER_ADMIN can access these specific dealer administration routes
router.use(authenticate);
router.use(authorize(UserRole.DEALER_ADMIN));

router.get('/dashboard', dealerController.getDashboard);

router.get('/team', dealerController.getTeam);
router.post('/team', dealerController.createTeamMember);
router.put('/team/:id', dealerController.updateTeamMember);
router.delete('/team/:id', dealerController.deactivateTeamMember);

router.get('/settings', dealerController.getSettings);
router.put('/settings', dealerController.updateSettings);

export default router;
