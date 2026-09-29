import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { prisma } from '../lib/clients';
import {
  collectBusinessSnapshot,
  generateAiReport,
  ReportPeriod,
} from '../services/reporting.service';

const PERIODS: ReportPeriod[] = ['today', 'week', 'month', 'all'];
function parsePeriod(v: any): ReportPeriod {
  return PERIODS.includes(v) ? v : 'month';
}

// Admin/founder see the whole business; dealer-scoped roles see only their own.
function scopeDealer(req: AuthenticatedRequest): string | null {
  return req.user?.dealerId || null;
}

// GET /api/reports/snapshot?period=month — raw cross-module metrics.
export const getSnapshot = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = await collectBusinessSnapshot(parsePeriod(req.query.period), scopeDealer(req));
    res.json({ success: true, data: snapshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err?.message || 'Snapshot failed' } });
  }
};

// POST /api/reports/ai — AI founder briefing from a fresh snapshot.
// body: { period?, strategy?, language? }
export const getAiReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = parsePeriod(req.body?.period);
    const snapshot = await collectBusinessSnapshot(period, scopeDealer(req));
    const report = await generateAiReport(snapshot, req.body?.strategy, req.body?.language === 'english' ? 'english' : 'hinglish');

    // Persist so the founder can revisit it and the scheduler can reuse the flow.
    if (req.user?.id) {
      await prisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'BUSINESS_REPORT',
          title: `Business Report — ${period}`,
          message: report.text.slice(0, 4000),
          entityType: 'REPORT',
        },
      }).catch(() => { /* non-critical */ });
    }

    res.json({ success: true, data: { ...report, snapshot } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err?.message || 'AI report failed' } });
  }
};

// GET /api/reports/history — previously generated reports for this user.
export const getReportHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await prisma.notification.findMany({
      where: { userId: req.user?.id, type: 'BUSINESS_REPORT' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err?.message || 'History failed' } });
  }
};
