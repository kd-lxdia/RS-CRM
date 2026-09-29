const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['test-escalation-user1@example.com', 'test-escalation-supervisor@example.com'],
        },
      },
    });

    console.log('Found users:', users.map(u => ({ id: u.id, email: u.email })));

    if (users.length > 0) {
      const userIds = users.map(u => u.id);

      // Delete escalation logs first
      const deletedEscalations = await prisma.escalationLog.deleteMany({
        where: {
          OR: [
            { fromUserId: { in: userIds } },
            { toUserId: { in: userIds } },
          ],
        },
      });
      console.log(`Deleted ${deletedEscalations.count} escalation logs`);

      // Delete tasks
      const deletedTasks = await prisma.task.deleteMany({
        where: {
          OR: [
            { createdBy: { in: userIds } },
            { assignedTo: { in: userIds } },
          ],
        },
      });
      console.log(`Deleted ${deletedTasks.count} tasks`);

      // Delete users
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
        },
      });
      console.log(`Deleted ${deletedUsers.count} users`);
    }

    console.log('Cleanup complete');
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
