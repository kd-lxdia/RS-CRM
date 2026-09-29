import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  listCampaigns, createCampaign, getCampaign, updateCampaignStatus, deleteCampaign,
} from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { dealerScope } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UserRole } from '@slar-crm/shared';

const router = Router();
router.use(authenticate, dealerScope);

const ALLOWED_ROLES = [UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN, UserRole.PROJECT_HEAD];

router.get('/', authorize(...ALLOWED_ROLES), listCampaigns);
router.post('/', authorize(...ALLOWED_ROLES), [
  body('name').notEmpty(), body('type').isIn(['WHATSAPP', 'EMAIL', 'BOTH']),
  body('templateId').notEmpty(), validate,
], createCampaign);
router.get('/:id', authorize(...ALLOWED_ROLES), getCampaign);
router.patch('/:id/status', authorize(...ALLOWED_ROLES), [
  body('status').isIn(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED']), validate,
], updateCampaignStatus);
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.DEALER_ADMIN), deleteCampaign);

export default router;
