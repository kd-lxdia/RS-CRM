import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notification.controller';
import { 
  createTestNotification, 
  createDemoNotificationsController, 
  clearNotificationsController 
} from '../controllers/test-notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.post('/test', createTestNotification);
router.post('/demo', createDemoNotificationsController);
router.delete('/clear', clearNotificationsController);

export default router;
