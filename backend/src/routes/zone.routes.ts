import { Router } from 'express';
import { listZones, createZone, updateZone, deleteZone, getZoneSalespersons } from '../controllers/zone.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { body } from 'express-validator';
import { UserRole } from '@slar-crm/shared';

const router = Router();

// Only ADMIN can manage zones
router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/', listZones);

router.post('/', [
  body('name').notEmpty().withMessage('Zone name is required'),
  body('coordinates').isArray().withMessage('Coordinates must be an array of [lat, lng] pairs'),
  validate
], createZone);

router.put('/:id', validate, updateZone);
router.delete('/:id', deleteZone);
router.get('/:id/salespersons', getZoneSalespersons);

export default router;
