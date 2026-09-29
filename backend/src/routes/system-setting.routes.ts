import { Router } from 'express';
import { getSetting, updateSetting, getAllSettings } from '../controllers/system-setting.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

router.use(authenticate); // Ensure user is authenticated

router.get('/', getAllSettings);
router.route('/:key')
  .get(getSetting)
  .post(authorize(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROJECT_HEAD), updateSetting)
  .put(authorize(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROJECT_HEAD), updateSetting);

export default router;
