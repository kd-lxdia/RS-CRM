import { Request, Response } from 'express';
import { performanceMonitorService } from '../services/performance-monitor.service';
import { AuthenticatedRequest } from '../middlewares/auth';

export class PerformanceController {
  /**
   * Get performance metrics for a specific user
   * GET /api/performance/users/:userId
   */
  async getUserMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const timeframe = startDate && endDate
        ? { startDate: new Date(startDate as string), endDate: new Date(endDate as string) }
        : undefined;

      const metrics = await performanceMonitorService.calculateMetrics(userId, timeframe);

      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Error in getUserMetrics:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get team performance for a supervisor
   * GET /api/performance/team/:supervisorId
   */
  async getTeamPerformance(req: AuthenticatedRequest, res: Response) {
    try {
      const { supervisorId } = req.params;
      const { startDate, endDate } = req.query;

      const timeframe = startDate && endDate
        ? { startDate: new Date(startDate as string), endDate: new Date(endDate as string) }
        : undefined;

      const teamData = await performanceMonitorService.getTeamPerformance(supervisorId, timeframe);

      res.json({ success: true, data: teamData });
    } catch (error) {
      console.error('Error in getTeamPerformance:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get performance history for a user
   * GET /api/performance/users/:userId/history
   */
  async getPerformanceHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const history = await performanceMonitorService.getPerformanceHistory(userId, days);

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Error in getPerformanceHistory:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get my own performance metrics
   * GET /api/performance/me
   */
  async getMyMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const metrics = await performanceMonitorService.calculateMetrics(userId);

      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Error in getMyMetrics:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Check performance alerts for a supervisor's team
   * GET /api/performance/team/:supervisorId/alerts
   */
  async getPerformanceAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      const { supervisorId } = req.params;

      const alerts = await performanceMonitorService.checkPerformanceAlerts(supervisorId);

      res.json({ success: true, data: alerts });
    } catch (error) {
      console.error('Error in getPerformanceAlerts:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Trigger performance snapshot calculation for a user
   * POST /api/performance/users/:userId/snapshot
   */
  async triggerSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;

      const metrics = await performanceMonitorService.calculateMetrics(userId);
      await performanceMonitorService.saveSnapshot(userId, metrics);

      res.json({ success: true, message: 'Snapshot created', data: metrics });
    } catch (error) {
      console.error('Error in triggerSnapshot:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const performanceController = new PerformanceController();
