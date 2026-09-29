import { PrismaClient } from '@prisma/client';
import { createNotification } from './notification-generator.service';

const prisma = new PrismaClient();

export async function createDemoNotifications(userId: string) {
  const demoNotifications = [
    {
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: 'You have been assigned a new task: "Complete customer documentation for Solar Project #SP-2024-001"',
      entityType: 'TASK',
      entityId: 'demo-task-1'
    },
    {
      type: 'TASK_DUE_SOON',
      title: 'Task Due Tomorrow',
      message: 'Task "Site survey for residential installation" is due tomorrow at 5:00 PM',
      entityType: 'TASK',
      entityId: 'demo-task-2'
    },
    {
      type: 'TASK_OVERDUE',
      title: 'Task Overdue',
      message: 'Task "Upload customer Aadhaar documents" is now 2 days overdue!',
      entityType: 'TASK',
      entityId: 'demo-task-3'
    },
    {
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: 'Solar Panel - Mono PERC 540W (SKU: SP-540-MP) is running low. Current: 15 units, Threshold: 20 units',
      entityType: 'STOCK_ITEM',
      entityId: 'demo-stock-1'
    },
    {
      type: 'TASK_COMPLETED',
      title: 'Team Task Completed',
      message: 'Rajesh Kumar completed task: "Install 5kW solar system at Sector 21, Gurgaon"',
      entityType: 'TASK',
      entityId: 'demo-task-4'
    },
    {
      type: 'TASK_OVERDUE_ALERT',
      title: 'Team Member Task Overdue',
      message: 'Priya Sharma has an overdue task: "Generate invoice for customer ID CU-2024-156"',
      entityType: 'TASK',
      entityId: 'demo-task-5'
    },
    {
      type: 'LOW_STOCK_SUMMARY',
      title: 'Inventory Alert Summary',
      message: '5 items are running low on stock. Please review inventory levels and place orders.',
      entityType: 'STOCK',
      entityId: 'summary'
    },
    {
      type: 'TASK_STATUS_CHANGED',
      title: 'Task Status Updated',
      message: 'Task "Customer agreement signing" status changed from "In Progress" to "Completed"',
      entityType: 'TASK',
      entityId: 'demo-task-6'
    },
    {
      type: 'TASK_DUE_SOON',
      title: 'Task Due Today',
      message: 'Task "Follow up with lead - Amit Verma" is due today at 2:30 PM',
      entityType: 'TASK',
      entityId: 'demo-task-7'
    },
    {
      type: 'LOW_STOCK',
      title: 'Critical Stock Alert',
      message: 'Inverter - 5kW String Inverter (SKU: INV-5K-STR) is critically low. Current: 3 units, Threshold: 10 units',
      entityType: 'STOCK_ITEM',
      entityId: 'demo-stock-2'
    }
  ];

  // Create notifications with some delay to show different timestamps
  for (let i = 0; i < demoNotifications.length; i++) {
    const notification = demoNotifications[i];
    
    // Create some notifications as read and some as unread for demo
    const isRead = i % 3 === 0; // Every 3rd notification is read
    
    await createNotification({
      userId,
      ...notification
    });

    // Mark some as read
    if (isRead) {
      // Find the notification we just created and mark it as read
      const createdNotification = await prisma.notification.findFirst({
        where: {
          userId,
          type: notification.type,
          title: notification.title
        },
        orderBy: { createdAt: 'desc' }
      });

      if (createdNotification) {
        await prisma.notification.update({
          where: { id: createdNotification.id },
          data: { isRead: true }
        });
      }
    }

    // Add small delay to create different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Created ${demoNotifications.length} demo notifications for user ${userId}`);
}

export async function createDemoNotificationsForAllUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });

    for (const user of users) {
      await createDemoNotifications(user.id);
    }

    console.log(`Created demo notifications for ${users.length} users`);
  } catch (error) {
    console.error('Error creating demo notifications:', error);
  }
}

export async function clearAllNotifications(userId?: string) {
  try {
    if (userId) {
      await prisma.notification.deleteMany({
        where: { userId }
      });
      console.log(`Cleared notifications for user ${userId}`);
    } else {
      await prisma.notification.deleteMany({});
      console.log('Cleared all notifications');
    }
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}