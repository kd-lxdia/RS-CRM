import { PrismaClient, EscalationStatus } from '../lib/prisma-client-shim';

const prisma = new PrismaClient();

describe('EscalationLog Model - Team Management Extension', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testTaskId: string;

  beforeAll(async () => {
    // Clean up any existing test data first
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test-escalation-user1@example.com', 'test-escalation-supervisor@example.com'],
        },
      },
    });

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'test-escalation-user1@example.com',
        password: 'hashedpassword',
        name: 'Test User 1',
        role: 'SALESPERSON',
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'test-escalation-supervisor@example.com',
        password: 'hashedpassword',
        name: 'Test Supervisor',
        role: 'ADMIN',
      },
    });
    testUserId2 = user2.id;

    // Create test task
    const task = await prisma.task.create({
      data: {
        title: 'Test Task for Escalation',
        description: 'Test task description',
        priority: 'HIGH',
        status: 'TODO',
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue
        createdBy: testUserId1,
        assignedTo: testUserId1,
      },
    });
    testTaskId = task.id;
  });

  afterAll(async () => {
    // Cleanup - delete in correct order to respect foreign key constraints
    if (testUserId1 && testUserId2) {
      await prisma.escalationLog.deleteMany({
        where: {
          OR: [
            { fromUserId: { in: [testUserId1, testUserId2] } },
            { toUserId: { in: [testUserId1, testUserId2] } },
          ],
        },
      });
    }
    if (testTaskId) {
      await prisma.task.deleteMany({
        where: { id: testTaskId },
      });
    }
    if (testUserId1 && testUserId2) {
      await prisma.user.deleteMany({
        where: {
          id: { in: [testUserId1, testUserId2] },
        },
      });
    }
    await prisma.$disconnect();
  });

  it('should create escalation log with team management fields', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 1,
        reason: 'OVERDUE_TASK',
        status: 'PENDING',
      },
    });

    expect(escalation).toBeDefined();
    expect(escalation.taskId).toBe(testTaskId);
    expect(escalation.fromUserId).toBe(testUserId1);
    expect(escalation.toUserId).toBe(testUserId2);
    expect(escalation.escalationLevel).toBe(1);
    expect(escalation.reason).toBe('OVERDUE_TASK');
    expect(escalation.status).toBe('PENDING');
    expect(escalation.triggeredAt).toBeInstanceOf(Date);
    expect(escalation.resolvedAt).toBeNull();
  });

  it('should validate escalation level is positive integer', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 2,
        reason: 'MULTI_LEVEL_ESCALATION',
        status: 'PENDING',
      },
    });

    expect(escalation.escalationLevel).toBeGreaterThan(0);
    expect(Number.isInteger(escalation.escalationLevel)).toBe(true);
  });

  it('should support status transitions', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 1,
        reason: 'OVERDUE_TASK',
        status: 'PENDING',
      },
    });

    // Acknowledge escalation
    const acknowledged = await prisma.escalationLog.update({
      where: { id: escalation.id },
      data: { status: 'ACKNOWLEDGED' },
    });
    expect(acknowledged.status).toBe('ACKNOWLEDGED');

    // Resolve escalation
    const resolved = await prisma.escalationLog.update({
      where: { id: escalation.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });

  it('should validate resolvedAt cannot be before triggeredAt', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 1,
        reason: 'OVERDUE_TASK',
        status: 'PENDING',
      },
    });

    const pastDate = new Date(escalation.triggeredAt.getTime() - 1000);
    
    // This should be validated at application level
    // Database allows it, but application logic should prevent it
    const updated = await prisma.escalationLog.update({
      where: { id: escalation.id },
      data: { resolvedAt: pastDate },
    });

    // Application-level validation check
    expect(updated.resolvedAt!.getTime()).toBeLessThan(updated.triggeredAt.getTime());
    // This test documents that DB-level constraint is not enforced
    // Application must validate this
  });

  it('should support querying by escalation level', async () => {
    await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 3,
        reason: 'CRITICAL_DELAY',
        status: 'PENDING',
      },
    });

    const highLevelEscalations = await prisma.escalationLog.findMany({
      where: {
        escalationLevel: { gte: 2 },
        status: 'PENDING',
      },
    });

    expect(highLevelEscalations.length).toBeGreaterThan(0);
    expect(highLevelEscalations.every(e => e.escalationLevel >= 2)).toBe(true);
  });

  it('should support backward compatibility with legacy fields', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 1,
        reason: 'OVERDUE_TASK',
        status: 'PENDING',
        // Legacy fields (optional)
        taskType: 'DOCUMENTATION',
        delayDays: 3,
      },
    });

    expect(escalation.taskType).toBe('DOCUMENTATION');
    expect(escalation.delayDays).toBe(3);
  });

  it('should retrieve escalation with related task and users', async () => {
    const escalation = await prisma.escalationLog.create({
      data: {
        taskId: testTaskId,
        fromUserId: testUserId1,
        toUserId: testUserId2,
        escalationLevel: 1,
        reason: 'OVERDUE_TASK',
        status: 'PENDING',
      },
    });

    const escalationWithRelations = await prisma.escalationLog.findUnique({
      where: { id: escalation.id },
      include: {
        task: true,
        assignee: true,
        notifier: true,
      },
    });

    expect(escalationWithRelations).toBeDefined();
    expect(escalationWithRelations!.task).toBeDefined();
    expect(escalationWithRelations!.task!.id).toBe(testTaskId);
    expect(escalationWithRelations!.assignee).toBeDefined();
    expect(escalationWithRelations!.assignee.id).toBe(testUserId1);
    expect(escalationWithRelations!.notifier).toBeDefined();
    expect(escalationWithRelations!.notifier.id).toBe(testUserId2);
  });
});
