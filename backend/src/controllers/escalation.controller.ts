import { Request, Response } from 'express';
import { escalationEngineService } from '../services/escalation-engine.service';
import { AuthenticatedRequest } from '../middlewares/auth';
import { EscalationStatus } from '../lib/prisma-client-shim';

export class EscalationController {
  /**
   * Trigger escalation check for all overdue tasks
   * POST /api/escalations/check
   */
  async checkEscalations(req: AuthenticatedRequest, res: Response) {
    try {
      const escalations = await escalationEngineService.checkOverdueTasks();
      res.json({
        success: true,
        message: `Processed ${escalations.length} escalations`,
        data: escalations,
      });
    } catch (error) {
      console.error('Error in checkEscalations:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Manually escalate a specific task
   * POST /api/escalations/tasks/:taskId
   */
  async escalateTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const { reason } = req.body;

      await escalationEngineService.escalateTask(taskId, reason || 'MANUAL_ESCALATION');

      res.json({ success: true, message: 'Task escalated successfully' });
    } catch (error: any) {
      console.error('Error in escalateTask:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to escalate task' });
    }
  }

  /**
   * Get escalation logs with filters
   * GET /api/escalations
   */
  async getEscalationLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, userId, taskId, limit, offset } = req.query;

      const result = await escalationEngineService.getEscalationLogs({
        status: status as EscalationStatus | undefined,
        userId: userId as string | undefined,
        taskId: taskId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({ success: true, data: result.logs, total: result.total });
    } catch (error) {
      console.error('Error in getEscalationLogs:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Acknowledge an escalation
   * PATCH /api/escalations/:id/acknowledge
   */
  async acknowledgeEscalation(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      await escalationEngineService.acknowledgeEscalation(id, userId);

      res.json({ success: true, message: 'Escalation acknowledged' });
    } catch (error) {
      console.error('Error in acknowledgeEscalation:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Resolve an escalation
   * PATCH /api/escalations/:id/resolve
   */
  async resolveEscalation(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      await escalationEngineService.resolveEscalation(id, userId);

      res.json({ success: true, message: 'Escalation resolved' });
    } catch (error) {
      console.error('Error in resolveEscalation:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get escalation rules
   * GET /api/escalations/rules
   */
  async getEscalationRules(req: AuthenticatedRequest, res: Response) {
    try {
      const rules = escalationEngineService.getRules();
      res.json({ success: true, data: rules });
    } catch (error) {
      console.error('Error in getEscalationRules:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Update escalation rules
   * PUT /api/escalations/rules
   */
  async updateEscalationRules(req: AuthenticatedRequest, res: Response) {
    try {
      const { rules } = req.body;

      if (!Array.isArray(rules)) {
        return res.status(400).json({ success: false, error: 'rules must be an array' });
      }

      escalationEngineService.updateRules(rules);

      res.json({ success: true, message: 'Escalation rules updated', data: rules });
    } catch (error) {
      console.error('Error in updateEscalationRules:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export const escalationController = new EscalationController();
