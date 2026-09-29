import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { epcV2Service } from '../services/epc-v2.service';

const actorFrom = (req: AuthenticatedRequest) => ({
  id: req.user!.id,
  role: req.user!.role,
});

const send = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

export const upsertLeadControl = handle(async (req, res) => {
  const data = await epcV2Service.upsertLeadControl({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const generateMissedFollowUpAlerts = handle(async (req, res) => {
  const data = await epcV2Service.generateMissedFollowUpAlerts(actorFrom(req));
  send(res, data, 201);
});

export const createProjectAfterAdvance = handle(async (req, res) => {
  const data = await epcV2Service.createProjectAfterAdvance({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const saveSurvey = handle(async (req, res) => {
  const data = await epcV2Service.saveSurvey({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const createQuotationCostSheet = handle(async (req, res) => {
  const data = await epcV2Service.createQuotationCostSheet({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const markQuotationSent = handle(async (req, res) => {
  const data = await epcV2Service.markQuotationSent(req.params.id, actorFrom(req));
  send(res, data);
});

export const reviseQuotation = handle(async (req, res) => {
  const data = await epcV2Service.reviseQuotation(req.params.id, {
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const upsertDesignControl = handle(async (req, res) => {
  const data = await epcV2Service.upsertDesignControl({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const getDesignQueue = handle(async (_req, res) => {
  const data = await epcV2Service.getDesignQueue();
  send(res, data);
});

export const approveQuotation = handle(async (req, res) => {
  const data = await epcV2Service.approveQuotation(req.params.id, actorFrom(req), req.body.remarks);
  send(res, data);
});

export const getPendingQuotationApprovals = handle(async (_req, res) => {
  const data = await epcV2Service.getPendingQuotationApprovals();
  send(res, data);
});

export const createBom = handle(async (req, res) => {
  const data = await epcV2Service.createBom({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const approveAndLockBom = handle(async (req, res) => {
  const data = await epcV2Service.approveAndLockBom(req.params.id, actorFrom(req));
  send(res, data);
});

export const recordMaterialMovement = handle(async (req, res) => {
  const data = await epcV2Service.recordMaterialMovement({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const upsertPaymentPlan = handle(async (req, res) => {
  const data = await epcV2Service.upsertPaymentPlan({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const generatePaymentReminders = handle(async (req, res) => {
  const data = await epcV2Service.generatePaymentReminders(actorFrom(req));
  send(res, data, 201);
});

export const recordActualProjectCost = handle(async (req, res) => {
  const data = await epcV2Service.recordActualProjectCost({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const getActualProjectCosts = handle(async (req, res) => {
  const data = await epcV2Service.getActualProjectCosts(req.query.projectId as string | undefined);
  send(res, data);
});

export const requestFounderOverride = handle(async (req, res) => {
  const data = await epcV2Service.requestFounderOverride({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const approveFounderOverride = handle(async (req, res) => {
  const data = await epcV2Service.approveFounderOverride(req.params.id, actorFrom(req));
  send(res, data);
});

export const saveInstallation = handle(async (req, res) => {
  const data = await epcV2Service.saveInstallation({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const createPunchPoint = handle(async (req, res) => {
  const data = await epcV2Service.createPunchPoint({
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const closePunchPoint = handle(async (req, res) => {
  const data = await epcV2Service.closePunchPoint(req.params.id, {
    ...req.body,
    actor: actorFrom(req),
  });
  send(res, data);
});

export const listPunchPoints = handle(async (req, res) => {
  const data = await epcV2Service.listPunchPoints(req.query.projectId as string | undefined);
  send(res, data);
});

export const upsertSubsidyTracker = handle(async (req, res) => {
  const data = await epcV2Service.upsertSubsidyTracker({
    ...req.body,
    projectId: req.params.projectId,
    actor: actorFrom(req),
  });
  send(res, data, 201);
});

export const getFounderControlRoom = handle(async (_req, res) => {
  const data = await epcV2Service.getFounderControlRoom();
  send(res, data);
});

export const getFounderControlRoomDrilldown = handle(async (req, res) => {
  const data = await epcV2Service.getFounderControlRoomDrilldown(req.params.type);
  send(res, data);
});

export const getProjectProfitabilityReport = handle(async (_req, res) => {
  const data = await epcV2Service.getProjectProfitabilityReport();
  send(res, data);
});

export const getBomDispatchComparisonReport = handle(async (_req, res) => {
  const data = await epcV2Service.getBomDispatchComparisonReport();
  send(res, data);
});

export const getSerialReport = handle(async (_req, res) => {
  const data = await epcV2Service.getSerialReport();
  send(res, data);
});

export const getDamagedMaterialReport = handle(async (_req, res) => {
  const data = await epcV2Service.getDamagedMaterialReport();
  send(res, data);
});

export const getCollectionReport = handle(async (_req, res) => {
  const data = await epcV2Service.getCollectionReport();
  send(res, data);
});

export const getSalespersonPaymentPendingReport = handle(async (_req, res) => {
  const data = await epcV2Service.getSalespersonPaymentPendingReport();
  send(res, data);
});

export const getProjectDeadlineReport = handle(async (_req, res) => {
  const data = await epcV2Service.getProjectDeadlineReport();
  send(res, data);
});

export const getInstallationDelayReport = handle(async (_req, res) => {
  const data = await epcV2Service.getInstallationDelayReport();
  send(res, data);
});

export const getSalesPerformanceReport = handle(async (_req, res) => {
  const data = await epcV2Service.getSalesPerformanceReport();
  send(res, data);
});

export const getCustomerFullProjectReport = handle(async (req, res) => {
  const data = await epcV2Service.getCustomerFullProjectReport(req.query.customerId as string | undefined);
  send(res, data);
});

export const getNetMeteringDelayReport = handle(async (_req, res) => {
  const data = await epcV2Service.getNetMeteringDelayReport();
  send(res, data);
});
