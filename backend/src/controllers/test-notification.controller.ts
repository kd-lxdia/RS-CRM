import { Response } from 'express';
import { createNotification } from '../services/notification-generator.service';
import { createDemoNotifications, clearAllNotifications } from '../services/demo-notifications.service';
import { AuthenticatedRequest } from '../middlewares/auth';

export const createTestNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type = 'TEST', title = 'Test Notification', message = 'This is a test notification' } = req.body;

    await createNotification({
      userId,
      type,
      title,
      message,
      entityType: 'TEST',
      entityId: 'test-' + Date.now()
    });

    res.json({ message: 'Test notification created successfully' });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
};

export const createDemoNotificationsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await createDemoNotifications(userId);
    res.json({ message: 'Demo notifications created successfully' });
  } catch (error) {
    console.error('Error creating demo notifications:', error);
    res.status(500).json({ error: 'Failed to create demo notifications' });
  }
};

export const clearNotificationsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await clearAllNotifications(userId);
    res.json({ message: 'Notifications cleared successfully' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
};