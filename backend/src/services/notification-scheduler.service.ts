import cron from 'node-cron';
import { 
  notifyTaskDueSoon, 
  notifyTaskOverdue, 
  notifyLowStock 
} from './notification-generator.service';
import { checkAndNotifyLowStock } from './stock-monitor.service';

export function initScheduledNotifications() {
  console.log('Initializing scheduled notifications...');

  // Check for due tasks every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running due task notifications...');
    try {
      await notifyTaskDueSoon();
    } catch (error) {
      console.error('Error in due task notifications:', error);
    }
  });

  // Check for overdue tasks and escalations every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('Running overdue task notifications and escalations...');
    try {
      await notifyTaskOverdue();
      const { escalationEngineService } = await import('./escalation-engine.service');
      await escalationEngineService.checkOverdueTasks();
    } catch (error) {
      console.error('Error in overdue task notifications/escalations:', error);
    }
  });

  // Check for low stock every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running low stock notifications...');
    try {
      await checkAndNotifyLowStock();
    } catch (error) {
      console.error('Error in low stock notifications:', error);
    }
  });

  // Daily summary at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily notification summary...');
    try {
      await notifyTaskDueSoon();
      await checkAndNotifyLowStock();
    } catch (error) {
      console.error('Error in daily notification summary:', error);
    }
  });

  // Auto business report: daily 8 AM (today) + Monday 8 AM (weekly) for every
  // owner/manager. Each gets an AI briefing dropped into their notifications.
  cron.schedule('0 8 * * *', async () => {
    const isMonday = new Date().getDay() === 1;
    console.log(`Running auto business report (${isMonday ? 'weekly+daily' : 'daily'})...`);
    try {
      const { collectBusinessSnapshot, generateAiReport } = await import('./reporting.service');
      const { prisma } = await import('../lib/clients');
      const owners = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['ADMIN', 'PROJECT_HEAD', 'DEALER_ADMIN'] } },
        select: { id: true, dealerId: true, role: true },
      });
      for (const period of isMonday ? (['week', 'today'] as const) : (['today'] as const)) {
        for (const owner of owners) {
          try {
            const snap = await collectBusinessSnapshot(period, owner.role === 'ADMIN' ? null : owner.dealerId);
            const report = await generateAiReport(snap);
            await prisma.notification.create({
              data: {
                userId: owner.id,
                type: 'BUSINESS_REPORT',
                title: `Auto ${period === 'week' ? 'Weekly' : 'Daily'} Business Report`,
                message: report.text.slice(0, 4000),
                entityType: 'REPORT',
              },
            });
          } catch (e) {
            console.error('Auto report failed for user', owner.id, e);
          }
        }
      }
    } catch (error) {
      console.error('Error in auto business report:', error);
    }
  });

  console.log('Scheduled notifications initialized successfully');
}