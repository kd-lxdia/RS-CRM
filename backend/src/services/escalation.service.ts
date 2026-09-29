import { Queue, Worker, Job } from 'bullmq';
import { prisma, redis } from '../lib/clients';

export const escalationQueue = redis ? new Queue('escalation-check', { connection: redis }) : null;

if (escalationQueue) {
  escalationQueue.add(
    'checkEscalations',
    {},
    {
      repeat: { pattern: '0 * * * *' },
    }
  ).catch(() => null);
}

export const escalationWorker = redis
  ? new Worker(
      'escalation-check',
      async (_job: Job) => {
        const now = new Date();
        const activeCustomers = await prisma.customer.findMany({
          where: { status: { not: 'COMPLETED' } },
          include: { timelineEvents: { orderBy: { createdAt: 'desc' }, take: 1 } },
        });

        for (const customer of activeCustomers) {
          const lastEvent = customer.timelineEvents[0];
          if (!lastEvent) continue;

          const diffMs = now.getTime() - new Date(lastEvent.createdAt).getTime();
          const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (delayDays <= 2) continue;

          const assignedTo =
            customer.assignedInstallation ||
            customer.assignedDocumentation ||
            customer.assignedSalesperson;
          if (!assignedTo) continue;

          const alreadyEscalated = await prisma.escalationLog.findFirst({
            where: {
              customerId: customer.id,
              fromUserId: assignedTo,
              taskType: lastEvent.eventType,
              resolved: false,
            },
          });

          if (alreadyEscalated) continue;

          const projectHead = await prisma.user.findFirst({
            where: { role: 'PROJECT_HEAD' as any, isActive: true },
            select: { id: true },
          });
          if (!projectHead) continue;

          await prisma.escalationLog.create({
            data: {
              customerId: customer.id,
              taskType: lastEvent.eventType,
              fromUserId: assignedTo,
              delayDays,
              toUserId: projectHead.id,
            },
          });
        }
      },
      { connection: redis }
    )
  : null;
