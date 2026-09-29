import { TeamHierarchyService, HierarchyChange } from '../services/team-hierarchy.service';

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  teamHierarchy: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the prisma instance
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('TeamHierarchyService', () => {
  let service: TeamHierarchyService;

  beforeEach(() => {
    service = new TeamHierarchyService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('validateHierarchyChange', () => {
    it('should prevent self-supervision (REQ-1.1.3)', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user1',
        newSupervisorId: 'user1', // Same user
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', name: 'Test User' });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User cannot supervise themselves');
    });

    it('should prevent circular supervision relationships (REQ-1.1.3)', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user1',
        newSupervisorId: 'user2',
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', name: 'Test User' });
      
      // Mock existing hierarchy where user2 is supervised by user1
      mockPrisma.teamHierarchy.findUnique
        .mockResolvedValueOnce({ // For user2 (new supervisor)
          userId: 'user2',
          path: '/user1/user2/',
          level: 1
        })
        .mockResolvedValueOnce({ // For user1 (current user)
          userId: 'user1',
          path: '/user1/',
          level: 0
        });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Would create circular supervision relationship');
    });

    it('should enforce maximum hierarchy depth of 10 levels (REQ-1.1.5)', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user11',
        newSupervisorId: 'user10',
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user11', name: 'Test User' });
      
      // Mock supervisor at level 10 (maximum)
      mockPrisma.teamHierarchy.findUnique.mockResolvedValue({
        userId: 'user10',
        level: 10, // At maximum level
        path: '/user1/user2/user3/user4/user5/user6/user7/user8/user9/user10/'
      });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum hierarchy depth of 10 levels exceeded');
    });

    it('should allow valid hierarchy changes', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user2',
        newSupervisorId: 'user1',
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user2', name: 'Test User' });
      mockPrisma.teamHierarchy.findUnique
        .mockResolvedValueOnce({ // For supervisor
          userId: 'user1',
          level: 0,
          path: '/user1/'
        })
        .mockResolvedValueOnce(null); // User not in hierarchy yet

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          teamHierarchy: {
            upsert: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue({
              userId: 'user1',
              level: 0,
              path: '/user1/'
            }),
            findMany: jest.fn().mockResolvedValue([])
          }
        });
      });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('materialized path calculations', () => {
    it('should calculate correct path for top-level user', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user1',
        newSupervisorId: null,
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', name: 'Test User' });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          teamHierarchy: {
            upsert: jest.fn().mockImplementation((params) => {
              expect(params.create.level).toBe(0);
              expect(params.create.path).toBe('/user1/');
              return Promise.resolve({});
            }),
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([])
          }
        });
      });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should calculate correct path for subordinate user', async () => {
      // Arrange
      const change: HierarchyChange = {
        userId: 'user2',
        newSupervisorId: 'user1',
        action: 'ASSIGN'
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user2', name: 'Test User' });
      mockPrisma.teamHierarchy.findUnique.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          teamHierarchy: {
            upsert: jest.fn()
              .mockResolvedValueOnce({}) // For supervisor creation
              .mockImplementation((params) => { // For user creation
                if (params.where.userId === 'user2') {
                  expect(params.create.level).toBe(1);
                  expect(params.create.path).toBe('/user1/user2/');
                }
                return Promise.resolve({});
              }),
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([])
          }
        });
      });

      // Act
      const result = await service.updateHierarchy(change);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('getTeamStructure', () => {
    it('should return all subordinates using materialized path', async () => {
      // Arrange
      const userId = 'user1';
      const mockUserHierarchy = {
        userId: 'user1',
        path: '/user1/',
        level: 0,
        user: { id: 'user1', name: 'Manager', email: 'manager@test.com', role: 'ADMIN' }
      };

      const mockSubordinates = [
        {
          userId: 'user2',
          path: '/user1/user2/',
          level: 1,
          user: { id: 'user2', name: 'Employee 1', email: 'emp1@test.com', role: 'SALESPERSON' }
        },
        {
          userId: 'user3',
          path: '/user1/user2/user3/',
          level: 2,
          user: { id: 'user3', name: 'Employee 2', email: 'emp2@test.com', role: 'SALESPERSON' }
        }
      ];

      mockPrisma.teamHierarchy.findUnique.mockResolvedValue(mockUserHierarchy);
      mockPrisma.teamHierarchy.findMany.mockResolvedValue(mockSubordinates);

      // Act
      const result = await service.getTeamStructure(userId);

      // Assert
      expect(result).toEqual(mockSubordinates);
      expect(mockPrisma.teamHierarchy.findMany).toHaveBeenCalledWith({
        where: {
          path: {
            startsWith: '/user1/'
          },
          userId: {
            not: 'user1'
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
    });

    it('should return empty array for user not in hierarchy', async () => {
      // Arrange
      const userId = 'nonexistent';
      mockPrisma.teamHierarchy.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getTeamStructure(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getDirectReports', () => {
    it('should return only direct subordinates', async () => {
      // Arrange
      const userId = 'user1';
      const mockDirectReports = [
        {
          userId: 'user2',
          supervisorId: 'user1',
          user: { id: 'user2', name: 'Direct Report 1', email: 'dr1@test.com', role: 'SALESPERSON' }
        }
      ];

      mockPrisma.teamHierarchy.findMany.mockResolvedValue(mockDirectReports);

      // Act
      const result = await service.getDirectReports(userId);

      // Assert
      expect(result).toEqual(mockDirectReports);
      expect(mockPrisma.teamHierarchy.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe('isSupervisor', () => {
    it('should correctly identify supervision relationship', async () => {
      // Arrange
      const supervisorId = 'user1';
      const subordinateId = 'user3';
      
      mockPrisma.teamHierarchy.findUnique.mockResolvedValue({
        userId: 'user3',
        path: '/user1/user2/user3/'
      });

      // Act
      const result = await service.isSupervisor(supervisorId, subordinateId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-supervision relationship', async () => {
      // Arrange
      const supervisorId = 'user1';
      const subordinateId = 'user4';
      
      mockPrisma.teamHierarchy.findUnique.mockResolvedValue({
        userId: 'user4',
        path: '/user5/user4/'
      });

      // Act
      const result = await service.isSupervisor(supervisorId, subordinateId);

      // Assert
      expect(result).toBe(false);
    });
  });
});