import { PrismaClient, TeamHierarchy, User } from '@prisma/client';
import { getIO } from '../lib/socket';

export interface HierarchyChange {
  userId: string;
  newSupervisorId: string | null;
  action: 'MOVE' | 'ASSIGN' | 'REMOVE';
}

export interface ValidationResult {
  success: boolean;
  error?: string;
}

export interface TeamNode {
  id: string;
  userId: string;
  name: string;
  role: string;
  level: number;
  supervisorId: string | null;
  path: string;
  directReports: number;
  isActive: boolean;
}

export class TeamHierarchyService {
  private prisma: PrismaClient;

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance || new PrismaClient();
  }
  /**
   * Create or update team hierarchy for a user
   * Validates REQ-1.1.3 (no circular references) and REQ-1.1.5 (max depth 10)
   */
  async updateHierarchy(change: HierarchyChange): Promise<ValidationResult> {
    try {
      // Validate the change
      const validation = await this.validateHierarchyChange(change);
      if (!validation.success) {
        return validation;
      }

      await this.prisma.$transaction(async (tx) => {
        if (change.action === 'REMOVE') {
          // Remove user from hierarchy
          await tx.teamHierarchy.updateMany({
            where: { userId: change.userId },
            data: { isActive: false }
          });
        } else {
          // Calculate new level and path
          const { level, path } = await this.calculateHierarchyData(
            change.newSupervisorId,
            change.userId,
            tx
          );

          // Upsert hierarchy record
          await tx.teamHierarchy.upsert({
            where: { userId: change.userId },
            update: {
              supervisorId: change.newSupervisorId,
              level,
              path,
              updatedAt: new Date()
            },
            create: {
              userId: change.userId,
              supervisorId: change.newSupervisorId,
              level,
              path
            }
          });

          // Update paths for all subordinates
          await this.updateSubordinatePaths(change.userId, tx);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating hierarchy:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Validate hierarchy change to prevent circular references (REQ-1.1.3)
   * and enforce maximum depth (REQ-1.1.5)
   */
  private async validateHierarchyChange(change: HierarchyChange): Promise<ValidationResult> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: change.userId }
    });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if supervisor exists (if provided)
    if (change.newSupervisorId) {
      const supervisor = await this.prisma.user.findUnique({
        where: { id: change.newSupervisorId }
      });
      if (!supervisor) {
        return { success: false, error: 'Supervisor not found' };
      }

      // Check for self-supervision
      if (change.userId === change.newSupervisorId) {
        return { success: false, error: 'User cannot supervise themselves' };
      }

      // Check for circular reference
      const wouldCreateCycle = await this.wouldCreateCircularReference(
        change.userId,
        change.newSupervisorId
      );
      if (wouldCreateCycle) {
        return { success: false, error: 'Would create circular supervision relationship' };
      }

      // Check maximum depth
      const supervisorHierarchy = await this.prisma.teamHierarchy.findUnique({
        where: { userId: change.newSupervisorId }
      });
      const newLevel = supervisorHierarchy ? supervisorHierarchy.level + 1 : 1;
      if (newLevel > 10) {
        return { success: false, error: 'Maximum hierarchy depth of 10 levels exceeded' };
      }
    }

    return { success: true };
  }

  /**
   * Check if assigning newSupervisorId to userId would create a circular reference
   */
  private async wouldCreateCircularReference(
    userId: string,
    newSupervisorId: string
  ): Promise<boolean> {
    // Get all ancestors of the new supervisor
    const supervisorHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId: newSupervisorId }
    });

    if (!supervisorHierarchy) {
      return false; // No hierarchy exists for supervisor, no cycle possible
    }

    // Check if userId is in the supervisor's path (would create cycle)
    const userHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId }
    });

    if (!userHierarchy) {
      return false; // User not in hierarchy yet, no cycle possible
    }

    // If supervisor's path contains user's path, it would create a cycle
    return supervisorHierarchy.path.includes(`/${userId}/`);
  }

  /**
   * Calculate level and materialized path for a user
   */
  private async calculateHierarchyData(
    supervisorId: string | null,
    userId: string,
    tx: any
  ): Promise<{ level: number; path: string }> {
    if (!supervisorId) {
      // Top-level user
      return { level: 0, path: `/${userId}/` };
    }

    const supervisorHierarchy = await tx.teamHierarchy.findUnique({
      where: { userId: supervisorId }
    });

    if (!supervisorHierarchy) {
      // Supervisor not in hierarchy yet, create as level 0
      await tx.teamHierarchy.upsert({
        where: { userId: supervisorId },
        update: {},
        create: {
          userId: supervisorId,
          supervisorId: null,
          level: 0,
          path: `/${supervisorId}/`
        }
      });
      return { level: 1, path: `/${supervisorId}/${userId}/` };
    }

    return {
      level: supervisorHierarchy.level + 1,
      path: `${supervisorHierarchy.path}${userId}/`
    };
  }

  /**
   * Update materialized paths for all subordinates when a user's path changes
   */
  private async updateSubordinatePaths(userId: string, tx: any): Promise<void> {
    const userHierarchy = await tx.teamHierarchy.findUnique({
      where: { userId }
    });

    if (!userHierarchy) return;

    // Find all subordinates (users whose path starts with this user's path)
    const subordinates = await tx.teamHierarchy.findMany({
      where: {
        path: {
          startsWith: userHierarchy.path,
          not: userHierarchy.path // Exclude the user themselves
        }
      }
    });

    // Update each subordinate's path and level
    for (const subordinate of subordinates) {
      const oldPathPrefix = userHierarchy.path;
      const newPath = subordinate.path.replace(oldPathPrefix, userHierarchy.path);
      const newLevel = newPath.split('/').filter(Boolean).length - 1;

      await tx.teamHierarchy.update({
        where: { id: subordinate.id },
        data: {
          path: newPath,
          level: newLevel
        }
      });
    }
  }

  /**
   * Get team structure for a user (all subordinates)
   */
  async getTeamStructure(userId: string): Promise<TeamHierarchy[]> {
    const userHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!userHierarchy) {
      return [];
    }

    // Get all subordinates using materialized path
    const subordinates = await this.prisma.teamHierarchy.findMany({
      where: {
        path: {
          startsWith: userHierarchy.path
        },
        userId: {
          not: userId // Exclude the user themselves
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { level: 'asc' },
        { path: 'asc' }
      ]
    });

    return subordinates;
  }

  /**
   * Get direct reports for a user
   */
  async getDirectReports(userId: string): Promise<TeamHierarchy[]> {
    return this.prisma.teamHierarchy.findMany({
      where: {
        supervisorId: userId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        user: {
          name: 'asc'
        }
      }
    });
  }

  /**
   * Get ancestors (supervisors) for a user
   */
  async getAncestors(userId: string): Promise<User[]> {
    const userHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId }
    });

    if (!userHierarchy || userHierarchy.level === 0) {
      return [];
    }

    // Extract user IDs from path
    const pathIds = userHierarchy.path
      .split('/')
      .filter(Boolean)
      .slice(0, -1); // Remove the user themselves

    if (pathIds.length === 0) {
      return [];
    }

    // Get users in order of hierarchy
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: pathIds
        }
      }
    });

    // Return in hierarchy order
    return pathIds.map(id => users.find(user => user.id === id)!).filter(Boolean);
  }

  /**
   * Check if user A is a supervisor of user B (direct or indirect)
   */
  async isSupervisor(supervisorId: string, subordinateId: string): Promise<boolean> {
    const subordinateHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId: subordinateId }
    });

    if (!subordinateHierarchy) {
      return false;
    }

    return subordinateHierarchy.path.includes(`/${supervisorId}/`);
  }

  /**
   * Get siblings (users with the same supervisor)
   */
  async getSiblings(userId: string): Promise<TeamHierarchy[]> {
    const userHierarchy = await this.prisma.teamHierarchy.findUnique({
      where: { userId }
    });

    if (!userHierarchy || !userHierarchy.supervisorId) {
      return [];
    }

    return this.prisma.teamHierarchy.findMany({
      where: {
        supervisorId: userHierarchy.supervisorId,
        userId: { not: userId },
        isActive: true
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });
  }

  /**
   * Get all descendants (full subtree) for a user
   */
  async getDescendants(userId: string): Promise<TeamHierarchy[]> {
    return this.getTeamStructure(userId);
  }

  /**
   * Get full team tree as structured nodes for visualization
   */
  async getFullTeamTree(): Promise<TeamNode[]> {
    const hierarchies = await this.prisma.teamHierarchy.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: [{ level: 'asc' }, { path: 'asc' }]
    });

    // Count direct reports for each user
    const directReportCounts = new Map<string, number>();
    for (const h of hierarchies) {
      if (h.supervisorId) {
        directReportCounts.set(
          h.supervisorId,
          (directReportCounts.get(h.supervisorId) || 0) + 1
        );
      }
    }

    return hierarchies.map(h => ({
      id: h.id,
      userId: h.userId,
      name: (h as any).user?.name || '',
      role: (h as any).user?.role || '',
      level: h.level,
      supervisorId: h.supervisorId,
      path: h.path,
      directReports: directReportCounts.get(h.userId) || 0,
      isActive: h.isActive
    }));
  }

  /**
   * Broadcast hierarchy change event via WebSocket
   */
  broadcastHierarchyChange(change: HierarchyChange): void {
    try {
      const io = getIO();
      io.emit('hierarchy_updated', {
        type: 'HIERARCHY_CHANGE',
        change,
        timestamp: new Date().toISOString()
      });
    } catch {
      // Socket not initialized — non-fatal
    }
  }

  /**
   * Update hierarchy and broadcast change
   */
  async updateHierarchyAndBroadcast(change: HierarchyChange): Promise<ValidationResult> {
    const result = await this.updateHierarchy(change);
    if (result.success) {
      this.broadcastHierarchyChange(change);
    }
    return result;
  }
}

export const teamHierarchyService = new TeamHierarchyService();