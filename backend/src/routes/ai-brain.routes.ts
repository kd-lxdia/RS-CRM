import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import { complete, getConfig, putConfig, feedback } from '../controllers/ai-brain.controller';

const router = Router();

router.use(authenticate);

// Any authenticated user can run completions and give feedback.
router.post('/complete', complete);
router.post('/feedback', feedback);

// Only admins/founders can view or change provider config + keys.
router.get('/config', authorize(UserRole.ADMIN), getConfig);
router.put('/config', authorize(UserRole.ADMIN), putConfig);

export default router;
