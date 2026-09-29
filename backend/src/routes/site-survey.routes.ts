import { Router } from 'express';
import { createSiteSurvey, getSiteSurvey, updateSiteSurvey } from '../controllers/site-survey.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.post('/', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), createSiteSurvey);
router.get('/:customerId', authenticate, getSiteSurvey);
router.put('/:id', authenticate, authorize(UserRole.INSTALLATION, UserRole.ADMIN), updateSiteSurvey);

export default router;
