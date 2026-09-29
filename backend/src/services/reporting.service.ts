import { prisma } from '../lib/clients';
import { runBrain } from './ai-brain/AIBrain';

// Business Intelligence engine. Collects a cross-module snapshot of the whole
// business (sales, revenue, receivables, inventory, team, operations) and can
// turn it into a plain-language founder report via the AI Brain.

export type ReportPeriod = 'today' | 'week' | 'month' | 'all';

function periodStart(period: ReportPeriod): Date {
  const now = new Date();
  switch (period) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all': default: return new Date(2000, 0, 1);
  }
}

const money = (n: number | null | undefined) => Math.round(Number(n || 0));

export interface BusinessSnapshot {
  period: ReportPeriod;
  generatedAt: string;
  sales: {
    leadsByStatus: Record<string, number>;
    totalLeads: number;
    newLeadsInPeriod: number;
    rawLeadsPending: number;
    proposalsByStatus: Record<string, number>;
    proposalsSentInPeriod: number;
    wonInPeriod: number;
    conversionRatePct: number;
    pipelineValue: number;
  };
  revenue: {
    totalCollected: number;
    collectedInPeriod: number;
    outstandingReceivables: number;
    overdueAmount: number;
    overdueCount: number;
    invoicesByStatus: Record<string, number>;
    avgDealValue: number;
  };
  inventory: {
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    pendingDispatches: number;
  };
  operations: {
    openTasks: number;
    overdueTasks: number;
    visitsInPeriod: number;
    installationsPending: number;
    openEscalations: number;
    activeUsers: number;
  };
}

async function countGroup(model: any, by: string, where: any = {}): Promise<Record<string, number>> {
  const rows = await model.groupBy({ by: [by], _count: { _all: true }, where });
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r[by])] = r._count._all;
  return out;
}

export async function collectBusinessSnapshot(
  period: ReportPeriod = 'month',
  dealerId?: string | null,
): Promise<BusinessSnapshot> {
  const start = periodStart(period);
  const dealer = dealerId ? { dealerId } : {};
  const custDealer = dealerId ? { customer: { dealerId } } : {};

  const [
    leadsByStatus, totalLeads, newLeads, rawPending, proposalsByStatus,
    proposalsSent, wonProposals, acceptedProposals, pipelineAgg,
    totalCollected, collectedPeriod, invoicesByStatus, overdueAgg, receivablesAgg, avgDeal,
    stockItems, dispatchesPending,
    openTasks, overdueTasks, visits, installsPending, escalations, activeUsers,
  ] = await Promise.all([
    countGroup(prisma.lead, 'status', dealer),
    prisma.lead.count({ where: dealer }),
    prisma.lead.count({ where: { ...dealer, createdAt: { gte: start } } }),
    prisma.rawLead.count({ where: { ...dealer, status: 'NEW' } }),
    countGroup(prisma.solarProposal, 'status', dealerId ? { customer: { dealerId } } : {}),
    prisma.solarProposal.count({ where: { ...custDealer, status: 'SENT', createdAt: { gte: start } } }),
    prisma.solarProposal.count({ where: { ...custDealer, status: 'ACCEPTED', acceptedAt: { gte: start } } }),
    prisma.solarProposal.count({ where: { ...custDealer, status: 'ACCEPTED' } }),
    prisma.solarProposal.aggregate({ where: { ...custDealer, status: { in: ['SENT', 'DRAFT'] } }, _sum: { totalCost: true } }),
    prisma.payment.aggregate({ where: custDealer, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...custDealer, paymentDate: { gte: start } }, _sum: { amount: true } }),
    countGroup(prisma.invoice, 'status', custDealer),
    prisma.invoice.aggregate({ where: { ...custDealer, status: 'OVERDUE' }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.invoice.aggregate({ where: { ...custDealer, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, _sum: { totalAmount: true } }),
    prisma.solarProposal.aggregate({ where: { ...custDealer, status: 'ACCEPTED' }, _avg: { totalCost: true } }),
    prisma.stockItem.findMany({ select: { quantity: true, lowStockThreshold: true } }).catch(() => []),
    prisma.dispatch.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.task.count({ where: { completedAt: null } }).catch(() => 0),
    prisma.task.count({ where: { completedAt: null, dueDate: { lt: new Date() } } }).catch(() => 0),
    prisma.visit.count({ where: { createdAt: { gte: start } } }).catch(() => 0),
    prisma.epcInstallationControl?.count({ where: { qcStatus: { not: 'DONE' } } }).catch(() => 0) ?? 0,
    prisma.escalationLog.count({ where: { status: { not: 'RESOLVED' } } }).catch(() => 0),
    prisma.user.count({ where: { isActive: true, ...dealer } }).catch(() => 0),
  ]);

  const wonTotal = acceptedProposals;
  const conversion = totalLeads > 0 ? (wonTotal / totalLeads) * 100 : 0;

  let lowStock = 0, outStock = 0;
  for (const s of stockItems as any[]) {
    if (Number(s.quantity || 0) <= 0) outStock++;
    else if (s.lowStockThreshold != null && Number(s.quantity) <= Number(s.lowStockThreshold)) lowStock++;
  }

  return {
    period,
    generatedAt: new Date().toISOString(),
    sales: {
      leadsByStatus,
      totalLeads,
      newLeadsInPeriod: newLeads,
      rawLeadsPending: rawPending,
      proposalsByStatus,
      proposalsSentInPeriod: proposalsSent,
      wonInPeriod: wonProposals,
      conversionRatePct: Math.round(conversion * 10) / 10,
      pipelineValue: money(pipelineAgg._sum.totalCost),
    },
    revenue: {
      totalCollected: money(totalCollected._sum.amount),
      collectedInPeriod: money(collectedPeriod._sum.amount),
      outstandingReceivables: money(receivablesAgg._sum.totalAmount),
      overdueAmount: money(overdueAgg._sum.totalAmount),
      overdueCount: overdueAgg._count.id || 0,
      invoicesByStatus,
      avgDealValue: money(avgDeal._avg.totalCost),
    },
    inventory: {
      totalItems: (stockItems as any[]).length,
      lowStockItems: lowStock,
      outOfStockItems: outStock,
      pendingDispatches: dispatchesPending,
    },
    operations: {
      openTasks,
      overdueTasks,
      visitsInPeriod: visits,
      installationsPending: installsPending as number,
      openEscalations: escalations,
      activeUsers,
    },
  };
}

// Turn a snapshot into a plain-language founder briefing via the AI Brain.
// `strategyContext` lets the founder tell the AI what they're trying to do so
// the report is framed around their goals.
export async function generateAiReport(
  snapshot: BusinessSnapshot,
  strategyContext?: string,
  language: 'hinglish' | 'english' = 'hinglish',
): Promise<{ text: string; provider: string; logId?: string }> {
  const langLine = language === 'hinglish'
    ? 'Write in Hinglish (Hindi in Roman script mixed with English), the way an Indian founder talks.'
    : 'Write in clear professional English.';

  const system = [
    'You are the AI business analyst for a solar EPC company running on the SLAR CRM.',
    'You get a JSON snapshot of the whole business. Produce a crisp founder briefing.',
    langLine,
    'Structure: (1) 2-line headline — overall business health. (2) "Kya achha chal raha hai" (wins). ',
    '(3) "Kya dikkat hai" (risks/red flags with the actual numbers). (4) "Aaj/is hafte kya karna chahiye" — 3 concrete actions ranked by impact.',
    'Be specific: quote the numbers. Flag overdue receivables, low conversion, dead pipeline, low stock. No fluff, no generic advice.',
  ].join(' ');

  const user = [
    strategyContext ? `Founder ki strategy/goal: ${strategyContext}\n\n` : '',
    'Business snapshot JSON:\n',
    JSON.stringify(snapshot, null, 2),
  ].join('');

  const res = await runBrain({
    feature: 'business-report',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    maxTokens: 1200,
    temperature: 0.5,
  });
  return { text: res.text, provider: res.provider, logId: res.logId };
}
