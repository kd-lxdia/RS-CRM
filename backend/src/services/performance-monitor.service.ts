import { PrismaClient, TaskStatus } from '../lib/prisma-client-shim';
import { getIO } from '../lib/socket';
import { teamHierarchyService } from './team-hierarchy.service';

const prisma = new PrismaClient();

export interface TimeFrame {
  startDate: Date;
  endDate: Date;
}

export interface PerformanceMetrics {
  userId: string;
  taskCompletionRate: number;   // 0-100
  averageResponseTime: number;  // hours
  overdueTaskCount: number;
  qualityScore: number;         // 0-10
  totalTasks: number;
  completedTasks: number;
  productivityTrend: TrendData[];
  lastUpdated: Date;
}

export interface TrendData {
  date: string;
  completionRate: number;
  overdueCount: number;
  qualityScore: number;
}

export interface MemberPerformance {
  userId: string;
  name: string;
  role: string;
  metrics: PerformanceMetrics;
}

export interface TeamPerformanceData {
  supervisorId: string;
  members: MemberPerformance[];
  teamAverages: Omit<PerformanceMetrics, 'userId' | 'productivityTrend' | 'lastUpdated'>;
}

export class PerformanceMonitorService {
  /**
   * Calculate performance metrics for a single user within a timeframe
   */
  async calculateMetrics(userId: string, timeframe?: TimeFrame): Promise<PerformanceMetrics> {
    const endDate = timeframe?.endDate || new Date();
    const startDate = timeframe?.startDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();

    const tasks = await prisma.task.findMany({
      where: {
        assignedTo: userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const overdueTasks = tasks.filter(
      t => t.dueDate && t.dueDate < new Date() && t.status !== TaskStatus.COMPLETED
    );

    // Task completion rate (0-100)
    const taskCompletionRate = totalTasks > 0
      ? Math.round((completedTasks.length / totalTasks) * 10000) / 100
      : 0;

    // Average response time in hours
    let averageResponseTime = 0;
    const completedWithTime = completedTasks.filter(t => t.completedAt);
    if (completedWithTime.length > 0) {
      const totalHours = completedWithTime.reduce((sum, t) => {
        const diffMs = t.completedAt!.getTime() - t.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      averageResponseTime = Math.round((totalHours / completedWithTime.length) * 100) / 100;
    }

    // Quality score (0-10): based on completion rate and overdue ratio
    const overdueRatio = totalTasks > 0 ? overdueTasks.length / totalTasks : 0;
    const qualityScore = Math.max(0, Math.min(10,
      Math.round(((taskCompletionRate / 100) * 10 * (1 - overdueRatio)) * 100) / 100
    ));

    // Trend data (last 7 days)
    const productivityTrend = await this.calculateTrend(userId, 7);

    return {
      userId,
      taskCompletionRate,
      averageResponseTime,
      overdueTaskCount: overdueTasks.length,
      qualityScore,
      totalTasks,
      completedTasks: completedTasks.length,
      productivityTrend,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate trend data for the last N days
   */
  private async calculateTrend(userId: string, days: number): Promise<TrendData[]> {
    const trend: TrendData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayTasks = await prisma.task.findMany({
        where: {
          assignedTo: userId,
          createdAt: { gte: date, lt: nextDate },
        },
      });

      const completed = dayTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      const overdue = dayTasks.filter(
        t => t.dueDate && t.dueDate < new Date() && t.status !== TaskStatus.COMPLETED
      ).length;
      const completionRate = dayTasks.length > 0 ? (completed / dayTasks.length) * 100 : 0;
      const overdueRatio = dayTasks.length > 0 ? overdue / dayTasks.length : 0;
      const qualityScore = Math.max(0, Math.min(10, (completionRate / 100) * 10 * (1 - overdueRatio)));

      trend.push({
        date: date.toISOString().split('T')[0],
        completionRate: Math.round(completionRate * 100) / 100,
        overdueCount: overdue,
        qualityScore: Math.round(qualityScore * 100) / 100,
      });
    }

    return trend;
  }

  /**
   * Get performance metrics for all team members under a supervisor
   */
  async getTeamPerformance(supervisorId: string, timeframe?: TimeFrame): Promise<TeamPerformanceData> {
    const subordinates = await teamHierarchyService.getTeamStructure(supervisorId);

    const members: MemberPerformance[] = [];

    for (const sub of subordinates) {
      const user = await prisma.user.findUnique({
        where: { id: sub.userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) continue;

      const metrics = await this.calculateMetrics(sub.userId, timeframe);
      members.push({
        userId: user.id,
        name: user.name,
        role: user.role,
        metrics,
      });
    }

    // Calculate team averages
    const teamAverages = this.calculateTeamAverages(members);

    return { supervisorId, members, teamAverages };
  }

  /**
   * Calculate team averages from member performance data
   */
  private calculateTeamAverages(
    members: MemberPerformance[]
  ): Omit<PerformanceMetrics, 'userId' | 'productivityTrend' | 'lastUpdated'> {
    if (members.length === 0) {
      return {
        taskCompletionRate: 0,
        averageResponseTime: 0,
        overdueTaskCount: 0,
        qualityScore: 0,
        totalTasks: 0,
        completedTasks: 0,
      };
    }

    const sum = members.reduce(
      (acc, m) => ({
        taskCompletionRate: acc.taskCompletionRate + m.metrics.taskCompletionRate,
        averageResponseTime: acc.averageResponseTime + m.metrics.averageResponseTime,
        overdueTaskCount: acc.overdueTaskCount + m.metrics.overdueTaskCount,
        qualityScore: acc.qualityScore + m.metrics.qualityScore,
        totalTasks: acc.totalTasks + m.metrics.totalTasks,
        completedTasks: acc.completedTasks + m.metrics.completedTasks,
      }),
      { taskCompletionRate: 0, averageResponseTime: 0, overdueTaskCount: 0, qualityScore: 0, totalTasks: 0, completedTasks: 0 }
    );

    const count = members.length;
    return {
      taskCompletionRate: Math.round((sum.taskCompletionRate / count) * 100) / 100,
      averageResponseTime: Math.round((sum.averageResponseTime / count) * 100) / 100,
      overdueTaskCount: sum.overdueTaskCount,
      qualityScore: Math.round((sum.qualityScore / count) * 100) / 100,
      totalTasks: sum.totalTasks,
      completedTasks: sum.completedTasks,
    };
  }

  /**
   * Save a performance snapshot to the database
   */
  async saveSnapshot(userId: string, metrics: PerformanceMetrics): Promise<void> {
    const snapshotDate = new Date();
    snapshotDate.setHours(0, 0, 0, 0);

    await prisma.performanceSnapshot.upsert({
      where: { userId_snapshotDate: { userId, snapshotDate } },
      update: {
        taskCompletionRate: metrics.taskCompletionRate,
        averageResponseTime: metrics.averageResponseTime,
        overdueTaskCount: metrics.overdueTaskCount,
        qualityScore: metrics.qualityScore,
        calculatedAt: new Date(),
      },
      create: {
        userId,
        snapshotDate,
        taskCompletionRate: metrics.taskCompletionRate,
        averageResponseTime: metrics.averageResponseTime,
        overdueTaskCount: metrics.overdueTaskCount,
        qualityScore: metrics.qualityScore,
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * Get historical performance snapshots for a user
   */
  async getPerformanceHistory(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.performanceSnapshot.findMany({
      where: {
        userId,
        snapshotDate: { gte: startDate },
      },
      orderBy: { snapshotDate: 'asc' },
    });
  }

  /**
   * Broadcast performance metrics update via WebSocket
   */
  broadcastMetricsUpdate(supervisorId: string, data: TeamPerformanceData): void {
    try {
      const io = getIO();
      io.to(`user_${supervisorId}`).emit('performance_updated', {
        type: 'PERFORMANCE_UPDATE',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Socket not initialized — non-fatal
    }
  }

  /**
   * Check for performance alerts (>20% deviation from team average)
   */
  async checkPerformanceAlerts(supervisorId: string): Promise<Array<{
    userId: string;
    name: string;
    metric: string;
    value: number;
    teamAverage: number;
    deviation: number;
  }>> {
    const teamData = await this.getTeamPerformance(supervisorId);
    const alerts = [];

    for (const member of teamData.members) {
      const avgCompletion = teamData.teamAverages.taskCompletionRate;
      if (avgCompletion > 0) {
        const deviation = ((member.metrics.taskCompletionRate - avgCompletion) / avgCompletion) * 100;
        if (Math.abs(deviation) > 20) {
          alerts.push({
            userId: member.userId,
            name: member.name,
            metric: 'taskCompletionRate',
            value: member.metrics.taskCompletionRate,
            teamAverage: avgCompletion,
            deviation,
          });
        }
      }
    }

    return alerts;
  }
}

export const performanceMonitorService = new PerformanceMonitorService();
