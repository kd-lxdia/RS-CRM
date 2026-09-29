import { Request, Response } from 'express';
import { teamHierarchyService, HierarchyChange } from '../services/team-hierarchy.service';

export class TeamHierarchyController {
  /**
   * Update team hierarchy (drag-and-drop operations)
   * POST /api/team/hierarchy/update
   */
  async updateHierarchy(req: Request, res: Response) {
    try {
      const change: HierarchyChange = req.body;

      // Validate required fields
      if (!change.userId || !change.action) {
        return res.status(400).json({
          success: false,
          error: 'userId and action are required'
        });
      }

      const result = await teamHierarchyService.updateHierarchyAndBroadcast(change);

      if (result.success) {
        res.json({
          success: true,
          message: 'Hierarchy updated successfully'
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error in updateHierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get full team tree for visualization
   * GET /api/team/hierarchy/tree
   */
  async getFullTree(req: Request, res: Response) {
    try {
      const tree = await teamHierarchyService.getFullTeamTree();
      res.json({ success: true, data: tree });
    } catch (error) {
      console.error('Error in getFullTree:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get team structure for a user
   * GET /api/team/hierarchy/:userId/structure
   */
  async getTeamStructure(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const structure = await teamHierarchyService.getTeamStructure(userId);

      res.json({
        success: true,
        data: structure
      });
    } catch (error) {
      console.error('Error in getTeamStructure:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get direct reports for a user
   * GET /api/team/hierarchy/:userId/reports
   */
  async getDirectReports(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const reports = await teamHierarchyService.getDirectReports(userId);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      console.error('Error in getDirectReports:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get ancestors (supervisors) for a user
   * GET /api/team/hierarchy/:userId/ancestors
   */
  async getAncestors(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const ancestors = await teamHierarchyService.getAncestors(userId);

      res.json({
        success: true,
        data: ancestors
      });
    } catch (error) {
      console.error('Error in getAncestors:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get siblings for a user
   * GET /api/team/hierarchy/:userId/siblings
   */
  async getSiblings(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const siblings = await teamHierarchyService.getSiblings(userId);
      res.json({ success: true, data: siblings });
    } catch (error) {
      console.error('Error in getSiblings:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get descendants for a user
   * GET /api/team/hierarchy/:userId/descendants
   */
  async getDescendants(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const descendants = await teamHierarchyService.getDescendants(userId);
      res.json({ success: true, data: descendants });
    } catch (error) {
      console.error('Error in getDescendants:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Check if user A supervises user B
   * GET /api/team/hierarchy/check-supervision?supervisor=:supervisorId&subordinate=:subordinateId
   */
  async checkSupervision(req: Request, res: Response) {
    try {
      const { supervisor, subordinate } = req.query;

      if (!supervisor || !subordinate) {
        return res.status(400).json({
          success: false,
          error: 'supervisor and subordinate parameters are required'
        });
      }

      const isSupervisor = await teamHierarchyService.isSupervisor(
        supervisor as string,
        subordinate as string
      );

      res.json({
        success: true,
        data: {
          isSupervisor,
          supervisorId: supervisor,
          subordinateId: subordinate
        }
      });
    } catch (error) {
      console.error('Error in checkSupervision:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export const teamHierarchyController = new TeamHierarchyController();