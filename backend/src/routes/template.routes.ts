import { Router } from 'express';
import { body } from 'express-validator';
import { listTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate } from '../controllers/template.controller';
import { authenticate, authorize, dealerScope } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UserRole } from '@slar-crm/shared';

const router = Router();
router.use(authenticate, dealerScope);

const ALLOWED = [UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN];

router.get('/', authorize(...ALLOWED), listTemplates);
router.post('/', authorize(...ALLOWED), [
  body('name').notEmpty(), body('type').isIn(['WHATSAPP', 'EMAIL', 'BOTH']),
  body('body').notEmpty(), body('variables').isArray(), validate,
], createTemplate);
router.get('/:id', authorize(...ALLOWED), getTemplate);
router.put('/:id', authorize(...ALLOWED), updateTemplate);
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.DEALER_ADMIN), deleteTemplate);

export default router;
