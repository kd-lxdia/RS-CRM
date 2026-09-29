import { PrismaClient, TaskStatus, EscalationStatus } from '../lib/prisma-client-shim';
import { getIO } from '../lib/socket';
import { teamHierarchyService } from './team-hierarchy.service';
import { sendNotification } from './notification.service';

const prisma = new PrismaClient();

export interface EscalationEvent {
  taskId: string;
  assigneeId: string;
  supervisorId: string;
  daysPastDue: number;
  escalationLevel: number;
  reason: string;
}

export interface EscalationRule {
  daysOverdueThreshold: number;
  escalationLevel: number;
  notifyChannels: Array<'IN_APP' | 'EMAIL' | 'WHATSAPP'>;
  deduplicationWindowHours: number;
}

const DEFAULT_RULES: EscalationRule[] = [
  {
    daysOverdueThreshold: 2,
    escalationLevel: 1,
    notifyChannels: ['IN_APP'],
    deduplicationWindowHours: 24,
  },
  {
    daysOverdueThreshold: 5,
    escalationLevel: 2,
    notifyChannels: ['IN_APP', 'EMAIL'],
    deduplicationWindowHours: 24,
  },
];

export class EscalationEngineService {
  private rules: EscalationRule[] = DEFAULT_RULES;

  /**
   * Main entry point: check all overdue tasks and escalate as needed
   */
  async checkOverdueTasks(): Promise<EscalationEvent[]> {
    const now = new Date();
    const escalations: EscalationEvent[] = [];

    // Find all overdue tasks (past due date, not completed/cancelled)
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        dueDate: { lt: now },
        assignedTo: { not: null },
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    for (const task of overdueTasks) {
      if (!task.assignedTo || !task.assignee) continue;

      const daysPastDue = Math.floor(
        (now.getTime() - task.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Find applicable rule
      const applicableRule = this.getApplicableRule(daysPastDue);
      if (!applicableRule) continue;

      // Check deduplication: skip if already escalated within window
      const hasRecentEscalation = await this.hasRecentEscalation(
        task.id,
        applicableRule.deduplicationWindowHours
      );
      if (hasRecentEscalation) continue;

      // Get supervisor
      const supervisor = await this.getSupervisor(task.assignedTo);
      if (!supervisor) continue;

      // Create escalation event
      const escalation: EscalationEvent = {
        taskId: task.id,
        assigneeId: task.assignedTo,
        supervisorId: supervisor.id,
        daysPastDue,
        escalationLevel: applicableRule.escalationLevel,
        reason: 'OVERDUE_TASK',
      };

      // Log escalation
      await this.logEscalation(escalation);

      // Send notifications
      await this.sendEscalationNotifications(escalation, task, supervisor, applicableRule);

      // Broadcast via WebSocket
      this.broadcastEscalationEvent(escalation);

      escalations.push(escalation);
    }

    return escalations;
  }

  /**
   * Get the applicable escalation rule for a given days-past-due value
   */
  private getApplicableRule(daysPastDue: number): EscalationRule | null {
    // Find the highest-level rule that applies
    const applicable = this.rules
      .filter(r => daysPastDue >= r.daysOverdueThreshold)
      .sort((a, b) => b.escalationLevel - a.escalationLevel);

    return applicable[0] || null;
  }

  /**
   * Check if a task has been escalated recently (within deduplication window)
   */
  private async hasRecentEscalation(taskId: string, windowHours: number): Promise<boolean> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - windowHours);

    const recent = await prisma.escalationLog.findFirst({
      where: {
        taskId,
        triggeredAt: { gte: windowStart },
        status: { not: EscalationStatus.RESOLVED },
      },
    });

    return !!recent;
  }

  /**
   * Get the direct supervisor for a user
   */
  private async getSupervisor(userId: string): Promise<{ id: string; name: string; email: string; phone: string | null } | null> {
    const hierarchy = await prisma.teamHierarchy.findUnique({
      where: { userId },
    });

    if (!hierarchy?.supervisorId) {
      // Fall back to PROJECT_HEAD if no hierarchy supervisor
      return prisma.user.findFirst({
        where: { role: 'PROJECT_HEAD', isActive: true },
        select: { id: true, name: true, email: true, phone: true },
      });
    }

    return prisma.user.findUnique({
      where: { id: hierarchy.supervisorId },
      select: { id: true, name: true, email: true, phone: true },
    });
  }

  /**
   * Log escalation event to database
   */
  private async logEscalation(escalation: EscalationEvent): Promise<void> {
    await prisma.escalationLog.create({
      data: {
        taskId: escalation.taskId,
        fromUserId: escalation.assigneeId,
        toUserId: escalation.supervisorId,
        escalationLevel: escalation.escalationLevel,
        reason: escalation.reason,
        triggeredAt: new Date(),
        status: EscalationStatus.PENDING,
      },
    });
  }

  /**
   * Send escalation notifications via configured channels
   */
  private async sendEscalationNotifications(
    escalation: EscalationEvent,
    task: any,
    supervisor: { id: string; name: string; email: string; phone: string | null },
    rule: EscalationRule
  ): Promise<void> {
    const assignee = await prisma.user.findUnique({
      where: { id: escalation.assigneeId },
      select: { name: true },
    });

    const title = `Task Escalation - Level ${escalation.escalationLevel}`;
    const message = `Task "${task.title}" assigned to ${assignee?.name || 'a team member'} is ${escalation.daysPastDue} days overdue.`;

    // Notify supervisor
    await sendNotification({
      userId: escalation.supervisorId,
      type: 'SYSTEM_ALERT' as any,
      title,
      message,
      entityType: 'TASK',
      entityId: escalation.taskId,
      channels: rule.notifyChannels,
      emailData: rule.notifyChannels.includes('EMAIL') ? {
        to: supervisor.email,
        subject: title,
        html: `<p>${message}</p><p>Please review and take action.</p>`,
      } : undefined,
    });

    // Also notify the assignee
    await sendNotification({
      userId: escalation.assigneeId,
      type: 'SYSTEM_ALERT' as any,
      title: 'Your Task Has Been Escalated',
      message: `Task "${task.title}" has been escalated to your supervisor due to being ${escalation.daysPastDue} days overdue.`,
      entityType: 'TASK',
      entityId: escalation.taskId,
      channels: ['IN_APP'],
    });
  }

  /**
   * Broadcast escalation event via WebSocket
   */
  private broadcastEscalationEvent(escalation: EscalationEvent): void {
    try {
      const io = getIO();
      io.to(`user_${escalation.supervisorId}`).emit('escalation_triggered', {
        type: 'ESCALATION_EVENT',
        escalation,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Socket not initialized — non-fatal
    }
  }

  /**
   * Manually escalate a specific task
   */
  async escalateTask(taskId: string, reason: string = 'MANUAL_ESCALATION'): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true },
    });

    if (!task || !task.assignedTo) {
      throw new Error('Task not found or not assigned');
    }

    const supervisor = await this.getSupervisor(task.assignedTo);
    if (!supervisor) {
      throw new Error('No supervisor found for task assignee');
    }

    const daysPastDue = task.dueDate
      ? Math.max(0, Math.floor((new Date().getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const escalation: EscalationEvent = {
      taskId,
      assigneeId: task.assignedTo,
      supervisorId: supervisor.id,
      daysPastDue,
      escalationLevel: 1,
      reason,
    };

    await this.logEscalation(escalation);
    await this.sendEscalationNotifications(escalation, task, supervisor, DEFAULT_RULES[0]);
    this.broadcastEscalationEvent(escalation);
  }

  /**
   * Acknowledge an escalation
   */
  async acknowledgeEscalation(escalationId: string, userId: string): Promise<void> {
    await prisma.escalationLog.update({
      where: { id: escalationId },
      data: { status: EscalationStatus.ACKNOWLEDGED },
    });
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(escalationId: string, userId: string): Promise<void> {
    await prisma.escalationLog.update({
      where: { id: escalationId },
      data: {
        status: EscalationStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Get escalation logs with filters
   */
  async getEscalationLogs(filters: {
    status?: EscalationStatus;
    userId?: string;
    taskId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.userId) {
      where.OR = [
        { fromUserId: filters.userId },
        { toUserId: filters.userId },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.escalationLog.findMany({
        where,
        include: {
          task: { select: { id: true, title: true, dueDate: true, status: true } },
          assignee: { select: { id: true, name: true, role: true } },
          notifier: { select: { id: true, name: true, role: true } },
        },
        orderBy: { triggeredAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.escalationLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Update escalation rules
   */
  updateRules(rules: EscalationRule[]): void {
    this.rules = rules;
  }

  /**
   * Get current escalation rules
   */
  getRules(): EscalationRule[] {
    return this.rules;
  }
}

export const escalationEngineService = new EscalationEngineService();
