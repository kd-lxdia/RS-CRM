import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  approveAndLockBom,
  approveFounderOverride,
  generateMissedFollowUpAlerts,
  generatePaymentReminders,
  getBomDispatchComparisonReport,
  getCollectionReport,
  getCustomerFullProjectReport,
  getDamagedMaterialReport,
  getActualProjectCosts,
  closePunchPoint,
  approveQuotation,
  createPunchPoint,
  createBom,
  createProjectAfterAdvance,
  createQuotationCostSheet,
  getDesignQueue,
  getFounderControlRoom,
  getFounderControlRoomDrilldown,
  getInstallationDelayReport,
  getNetMeteringDelayReport,
  getPendingQuotationApprovals,
  getProjectDeadlineReport,
  getProjectProfitabilityReport,
  getSalesPerformanceReport,
  getSalespersonPaymentPendingReport,
  getSerialReport,
  listPunchPoints,
  markQuotationSent,
  recordActualProjectCost,
  recordMaterialMovement,
  requestFounderOverride,
  reviseQuotation,
  saveInstallation,
  saveSurvey,
  upsertDesignControl,
  upsertLeadControl,
  upsertPaymentPlan,
  upsertSubsidyTracker,
} from '../controllers/epc-v2.controller';

const router = Router();

router.use(authenticate);

router.post(
  '/leads/control',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.SALESPERSON, UserRole.CALLING_STAFF),
  upsertLeadControl
);

router.post(
  '/leads/missed-follow-up-alerts',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.SALESPERSON),
  generateMissedFollowUpAlerts
);

router.post(
  '/projects/after-advance',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT),
  createProjectAfterAdvance
);

router.post(
  '/surveys',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  saveSurvey
);

router.post(
  '/quotations/cost-sheet',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.SALESPERSON),
  createQuotationCostSheet
);

router.patch(
  '/quotations/:id/sent',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.SALESPERSON),
  markQuotationSent
);

router.post(
  '/quotations/:id/revise',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.SALESPERSON),
  reviseQuotation
);

router.post(
  '/design',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  upsertDesignControl
);

router.get(
  '/design/queue',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  getDesignQueue
);

router.post(
  '/quotations/:id/founder-approve',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  approveQuotation
);

router.post(
  '/quotations/:id/project-head-approve',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  approveQuotation
);

router.get(
  '/quotations/pending-approval',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getPendingQuotationApprovals
);

router.post(
  '/bom',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  createBom
);

router.post(
  '/bom/:id/approve-lock',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  approveAndLockBom
);

router.post(
  '/warehouse/material-movement',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.WAREHOUSE),
  recordMaterialMovement
);

router.post(
  '/payments/milestone-plan',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT),
  upsertPaymentPlan
);

router.post(
  '/payments/reminders',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT),
  generatePaymentReminders
);

router.post(
  '/actual-costs',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT, UserRole.WAREHOUSE),
  recordActualProjectCost
);

router.get(
  '/actual-costs',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT, UserRole.WAREHOUSE),
  getActualProjectCosts
);

router.post(
  '/founder-overrides',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.WAREHOUSE, UserRole.ACCOUNTANT, UserRole.SALESPERSON),
  requestFounderOverride
);

router.post(
  '/founder-overrides/:id/approve',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  approveFounderOverride
);

router.post(
  '/installation',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  saveInstallation
);

router.post(
  '/installation/punch-points',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  createPunchPoint
);

router.patch(
  '/installation/punch-points/:id/close',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  closePunchPoint
);

router.get(
  '/installation/punch-points',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.INSTALLATION),
  listPunchPoints
);

router.put(
  '/documentation/:projectId/subsidy',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.DOCUMENTATION),
  upsertSubsidyTracker
);

router.get(
  '/reports/project-profitability',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getProjectProfitabilityReport
);

router.get(
  '/reports/bom-dispatch-comparison',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.WAREHOUSE),
  getBomDispatchComparisonReport
);

router.get(
  '/reports/serials',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.WAREHOUSE),
  getSerialReport
);

router.get(
  '/reports/damaged-material',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.WAREHOUSE),
  getDamagedMaterialReport
);

router.get(
  '/reports/collection',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT),
  getCollectionReport
);

router.get(
  '/reports/salesperson-payment-pending',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT),
  getSalespersonPaymentPendingReport
);

router.get(
  '/reports/project-deadlines',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getProjectDeadlineReport
);

router.get(
  '/reports/installation-delay',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getInstallationDelayReport
);

router.get(
  '/reports/sales-performance',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getSalesPerformanceReport
);

router.get(
  '/reports/customer-full-project',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.ACCOUNTANT, UserRole.DOCUMENTATION),
  getCustomerFullProjectReport
);

router.get(
  '/reports/net-metering-delay',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getNetMeteringDelayReport
);

router.get(
  '/founder/control-room/drilldown/:type',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getFounderControlRoomDrilldown
);

router.get(
  '/founder/control-room',
  authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD),
  getFounderControlRoom
);

export default router;
