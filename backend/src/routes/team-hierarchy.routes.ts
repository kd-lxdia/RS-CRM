import { Router } from 'express';
import { teamHierarchyController } from '../controllers/team-hierarchy.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Full team tree (for visualization)
router.get('/hierarchy/tree', teamHierarchyController.getFullTree.bind(teamHierarchyController));

// Check supervision relationship
router.get('/hierarchy/check-supervision', teamHierarchyController.checkSupervision.bind(teamHierarchyController));

// Team hierarchy management routes
router.post(
  '/hierarchy/update',
  authorize(UserRole.ADMIN),
  teamHierarchyController.updateHierarchy.bind(teamHierarchyController)
);

router.get('/hierarchy/:userId/structure', teamHierarchyController.getTeamStructure.bind(teamHierarchyController));
router.get('/hierarchy/:userId/reports', teamHierarchyController.getDirectReports.bind(teamHierarchyController));
router.get('/hierarchy/:userId/ancestors', teamHierarchyController.getAncestors.bind(teamHierarchyController));
router.get('/hierarchy/:userId/siblings', teamHierarchyController.getSiblings.bind(teamHierarchyController));
router.get('/hierarchy/:userId/descendants', teamHierarchyController.getDescendants.bind(teamHierarchyController));

export default router;