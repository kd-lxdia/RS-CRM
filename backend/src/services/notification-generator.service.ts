import { PrismaClient, TaskStatus, TaskPriority } from '../lib/prisma-client-shim';
import { getIO } from '../lib/socket';

const prisma = new PrismaClient();

interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(payload: NotificationPayload) {
  const notification = await prisma.notification.create({
    data: payload
  });

  // Send real-time notification via socket
  try {
    const io = getIO();
    io.to(`user_${payload.userId}`).emit('notification', {
      id: notification.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      isRead: false,
      entityType: payload.entityType,
      entityId: payload.entityId,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    console.error('Error sending socket notification:', error);
  }

  return notification;
}

export async function notifyTaskDueSoon() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Tasks due today or tomorrow
  const dueTasks = await prisma.task.findMany({
    where: {
      status: { not: TaskStatus.COMPLETED },
      dueDate: {
        gte: today,
        lte: tomorrow
      }
    },
    include: {
      assignee: true,
      creator: true
    }
  });

  for (const task of dueTasks) {
    if (!task.assignedTo) continue;

    const dueDate = new Date(task.dueDate!);
    const isToday = dueDate.toDateString() === today.toDateString();
    const isTomorrow = dueDate.toDateString() === tomorrow.toDateString();

    let message = '';
    if (isToday) {
      message = `Task "${task.title}" is due today!`;
    } else if (isTomorrow) {
      message = `Task "${task.title}" is due tomorrow.`;
    }

    await createNotification({
      userId: task.assignedTo,
      type: 'TASK_DUE_SOON',
      title: 'Task Due Soon',
      message,
      entityType: 'TASK',
      entityId: task.id
    });
  }
}

export async function notifyTaskOverdue() {
  const now = new Date();

  const overdueTasks = await prisma.task.findMany({
    where: {
      status: { not: TaskStatus.COMPLETED },
      dueDate: { lt: now }
    },
    include: {
      assignee: true,
      creator: true
    }
  });

  for (const task of overdueTasks) {
    // Notify assignee
    if (task.assignedTo) {
      await createNotification({
        userId: task.assignedTo,
        type: 'TASK_OVERDUE',
        title: 'Task Overdue',
        message: `Task "${task.title}" is overdue!`,
        entityType: 'TASK',
        entityId: task.id
      });
    }

    // Notify project heads about overdue tasks
    const projectHeads = await prisma.user.findMany({
      where: {
        role: 'PROJECT_HEAD',
        isActive: true
      }
    });

    for (const head of projectHeads) {
      await createNotification({
        userId: head.id,
        type: 'TASK_OVERDUE_ALERT',
        title: 'Team Task Overdue',
        message: `${task.assignee?.name || 'A team member'} has an overdue task: "${task.title}"`,
        entityType: 'TASK',
        entityId: task.id
      });
    }
  }
}

export async function notifyLowStock() {
  const lowStockItems = await prisma.stockItem.findMany({
    where: {
      quantity: {
        lte: prisma.stockItem.fields.lowStockThreshold
      }
    }
  });

  if (lowStockItems.length === 0) return;

  // Notify warehouse staff
  const warehouseStaff = await prisma.user.findMany({
    where: {
      role: 'WAREHOUSE',
      isActive: true
    }
  });

  for (const staff of warehouseStaff) {
    for (const item of lowStockItems) {
      await createNotification({
        userId: staff.id,
        type: 'LOW_STOCK',
        title: 'Low Stock Alert',
        message: `Stock item "${item.name}" (SKU: ${item.sku}) is running low. Current quantity: ${item.quantity} ${item.unit}`,
        entityType: 'STOCK_ITEM',
        entityId: item.id
      });
    }
  }

  // Notify admins
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true
    }
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: 'LOW_STOCK_SUMMARY',
      title: 'Low Stock Summary',
      message: `${lowStockItems.length} item(s) are running low on stock.`,
      entityType: 'STOCK',
      entityId: 'summary'
    });
  }
}

export async function notifyTaskAssignment(taskId: string, assigneeId: string, assignerName: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });

  if (!task) return;

  await createNotification({
    userId: assigneeId,
    type: 'TASK_ASSIGNED',
    title: 'New Task Assigned',
    message: `${assignerName} assigned you a task: "${task.title}"`,
    entityType: 'TASK',
    entityId: taskId
  });
}

export async function notifyTaskStatusChange(taskId: string, newStatus: TaskStatus, changedBy: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      creator: true,
      assignee: true
    }
  });

  if (!task) return;

  // Notify creator if they're not the one who changed it
  if (task.createdBy !== changedBy) {
    await createNotification({
      userId: task.createdBy,
      type: 'TASK_STATUS_CHANGED',
      title: 'Task Status Updated',
      message: `Task "${task.title}" status changed to ${newStatus}`,
      entityType: 'TASK',
      entityId: taskId
    });
  }

  // If completed, notify project heads
  if (newStatus === TaskStatus.COMPLETED) {
    const projectHeads = await prisma.user.findMany({
      where: {
        role: 'PROJECT_HEAD',
        isActive: true
      }
    });

    for (const head of projectHeads) {
      await createNotification({
        userId: head.id,
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        message: `${task.assignee?.name || 'A team member'} completed task: "${task.title}"`,
        entityType: 'TASK',
        entityId: taskId
      });
    }
  }
}
