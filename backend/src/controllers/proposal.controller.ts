import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { ProposalStatus } from '../lib/prisma-client-shim';

export const createProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, customerId, ...fields } = req.body;
    const createdBy = (req as any).user.id;

    if (!leadId) return res.status(400).json({ success: false, error: { message: 'leadId required' } });

    const proposalCount = await prisma.solarProposal.count({ where: { leadId } });

    const hardwareCost = Number(fields.hardwareCost ?? 0);
    const structureCost = Number(fields.structureCost ?? 0);
    const labourCost = Number(fields.labourCost ?? 0);
    const transportationCost = Number(fields.transportationCost ?? 0);
    const netMeteringCost = Number(fields.netMeteringCost ?? 0);
    const netCost = Number(fields.netCost ?? 0);

    const totalCost = hardwareCost + structureCost + labourCost + transportationCost + netMeteringCost;
    const grossProfit = netCost - totalCost;
    const marginPercentage = netCost > 0 ? (grossProfit / netCost) * 100 : 0;

    const proposal = await prisma.solarProposal.create({
      data: {
        leadId,
        customerId: customerId || undefined,
        createdBy,
        status: ProposalStatus.DRAFT,
        systemSizeKw: Number(fields.systemSizeKw ?? fields.systemKw ?? 0),
        panelBrand: fields.panelBrand ?? '',
        panelModel: fields.panelModel ?? '',
        panelCount: Number(fields.panelCount ?? 0),
        panelWattage: Number(fields.panelWattage ?? 0),
        inverterBrand: fields.inverterBrand ?? '',
        inverterModel: fields.inverterModel ?? '',
        inverterCapacity: Number(fields.inverterCapacity ?? fields.inverterKw ?? 0),
        structureType: fields.structureType ?? 'GI',
        roofType: fields.roofType ?? 'RCC',
        isDCR: Boolean(fields.isDCR ?? false),
        hardwareCost,
        structureCost,
        labourCost,
        transportationCost,
        netMeteringCost,
        totalCost,
        grossProfit,
        marginPercentage,
        netCost,
        subsidyAmount: fields.totalSubsidy ? Number(fields.totalSubsidy) : null,
        subsidyScheme: fields.subsidyScheme ?? null,
        annualGeneration: fields.annualKwh ? Number(fields.annualKwh) : null,
        co2Savings: fields.co2Tonnes ? Number(fields.co2Tonnes) : null,
        loanApplicable: Boolean(fields.loanEnabled ?? false),
        loanAmount: fields.loanAmount ? Number(fields.loanAmount) : null,
        loanTenure: fields.loanTenure ? Number(fields.loanTenure) : null,
        emi: fields.emi ? Number(fields.emi) : null,
        model3dUrl: fields.model3dUrl ?? null,
      },
    });

    await prisma.timelineEvent.create({
      data: {
        leadId,
        eventType: 'PROPOSAL_CREATED',
        description: `Proposal #${proposalCount + 1} created`,
        performedBy: createdBy,
      },
    });

    res.status(201).json({ success: true, data: proposal });
  } catch (err) {
    next(err);
  }
};

export const getProposalsByLead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const proposals = await prisma.solarProposal.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, name: true, role: true } } },
    });
    res.json({ success: true, data: proposals });
  } catch (err) {
    next(err);
  }
};

export const getProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.solarProposal.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true, address: true, city: true } },
      },
    });
    if (!proposal) return res.status(404).json({ success: false, error: { message: 'Proposal not found' } });
    res.json({ success: true, data: proposal });
  } catch (err) {
    next(err);
  }
};

export const reviseProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: parentId } = req.params;
    const createdBy = (req as any).user.id;

    const parent = await prisma.solarProposal.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(404).json({ success: false, error: { message: 'Proposal not found' } });
    if (parent.status === ProposalStatus.ACCEPTED) {
      return res.status(409).json({ success: false, error: { message: 'Accepted proposals are locked.' } });
    }

    const { id: _id, createdAt: _ca, sentAt: _sa, ...copyFields } = parent as any;

    const merged = { ...copyFields, ...req.body };
    const hardwareCost = Number(merged.hardwareCost ?? 0);
    const structureCost = Number(merged.structureCost ?? 0);
    const labourCost = Number(merged.labourCost ?? 0);
    const transportationCost = Number(merged.transportationCost ?? 0);
    const netMeteringCost = Number(merged.netMeteringCost ?? 0);
    const netCost = Number(merged.netCost ?? 0);

    const totalCost = hardwareCost + structureCost + labourCost + transportationCost + netMeteringCost;
    const grossProfit = netCost - totalCost;
    const marginPercentage = netCost > 0 ? (grossProfit / netCost) * 100 : 0;

    const revision = await prisma.solarProposal.create({
      data: {
        ...copyFields,
        createdBy,
        status: ProposalStatus.DRAFT,
        sentAt: null,
        ...req.body,
        hardwareCost,
        structureCost,
        labourCost,
        transportationCost,
        netMeteringCost,
        totalCost,
        grossProfit,
        marginPercentage,
        netCost,
      },
    });

    await prisma.timelineEvent.create({
      data: {
        leadId: parent.leadId,
        eventType: 'PROPOSAL_REVISED',
        description: 'Proposal revised',
        performedBy: createdBy,
      },
    });

    res.status(201).json({ success: true, data: revision });
  } catch (err) {
    next(err);
  }
};

export const acceptProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user.id;

    const proposal = await prisma.solarProposal.findUnique({ where: { id } });
    if (!proposal) return res.status(404).json({ success: false, error: { message: 'Proposal not found' } });
    if (proposal.status === ProposalStatus.ACCEPTED) {
      return res.status(409).json({ success: false, error: { message: 'Already accepted' } });
    }

    await prisma.$transaction([
      prisma.solarProposal.updateMany({
        where: { leadId: proposal.leadId, id: { not: id }, status: { not: ProposalStatus.ACCEPTED } },
        data: { status: ProposalStatus.REJECTED },
      }),
      prisma.solarProposal.update({
        where: { id },
        data: { status: ProposalStatus.ACCEPTED },
      }),
      prisma.lead.update({
        where: { id: proposal.leadId },
        data: { status: 'WON' as any },
      }),
    ]);

    await prisma.timelineEvent.create({
      data: {
        leadId: proposal.leadId,
        eventType: 'PROPOSAL_ACCEPTED',
        description: 'Proposal accepted and lead marked WON',
        performedBy: actorId,
      },
    });

    const accepted = await prisma.solarProposal.findUnique({ where: { id } });
    res.json({ success: true, data: accepted });
  } catch (err) {
    next(err);
  }
};

export const sendProposal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.solarProposal.findUnique({ where: { id }, include: { lead: true } });
    if (!proposal) return res.status(404).json({ success: false, error: { message: 'Proposal not found' } });
    if (proposal.status === ProposalStatus.ACCEPTED) {
      return res.status(409).json({ success: false, error: { message: 'Accepted proposals cannot be modified' } });
    }

    await prisma.solarProposal.update({
      where: { id },
      data: { status: ProposalStatus.SENT, sentAt: new Date() },
    });

    await prisma.lead.update({ where: { id: proposal.leadId }, data: { status: 'PROPOSAL_SENT' as any } });

    await prisma.timelineEvent.create({
      data: {
        leadId: proposal.leadId,
        eventType: 'PROPOSAL_SENT',
        description: 'Proposal sent to customer',
        performedBy: (req as any).user.id,
      },
    });

    res.json({ success: true, message: 'Proposal marked as sent.' });
  } catch (err) {
    next(err);
  }
};

export const compareProposals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proposalIds } = req.body as { proposalIds: string[] };
    if (!Array.isArray(proposalIds) || proposalIds.length < 2 || proposalIds.length > 3) {
      return res.status(400).json({ success: false, error: { message: 'Provide 2-3 proposalIds' } });
    }

    const proposals = await prisma.solarProposal.findMany({
      where: { id: { in: proposalIds } },
      include: { creator: { select: { name: true } } },
    });

    const ordered = proposalIds.map((pid) => proposals.find((p) => p.id === pid)).filter(Boolean) as typeof proposals;
    if (ordered.length < 2) {
      return res.status(404).json({ success: false, error: { message: 'One or more proposals not found' } });
    }

    const fields = [
      { key: 'systemSizeKw', label: 'System Size (kW)', bestFn: Math.max },
      { key: 'panelCount', label: 'Panel Count', bestFn: null },
      { key: 'panelWattage', label: 'Panel Wattage', bestFn: Math.max },
      { key: 'panelBrand', label: 'Panel Brand', bestFn: null },
      { key: 'inverterBrand', label: 'Inverter Brand', bestFn: null },
      { key: 'annualGeneration', label: 'Annual Generation (kWh)', bestFn: Math.max },
      { key: 'totalCost', label: 'Total System Cost', bestFn: Math.min },
      { key: 'subsidyAmount', label: 'Subsidy', bestFn: Math.max },
      { key: 'netCost', label: 'Net Cost', bestFn: Math.min },
      { key: 'emi', label: 'EMI', bestFn: Math.min },
    ] as { key: string; label: string; bestFn: ((...args: number[]) => number) | null }[];

    const rows = fields.map(({ key, label, bestFn }) => {
      const values = ordered.map((p) => (p as any)[key]);
      const numericValues = values.filter((v) => typeof v === 'number') as number[];
      const bestValue = bestFn && numericValues.length > 0 ? bestFn(...numericValues) : null;
      return {
        key,
        label,
        values: values.map((v) => ({
          raw: v,
          formatted: typeof v === 'number' ? Math.round(v).toLocaleString('en-IN') : (v ?? '-'),
          isBest: bestValue !== null && v === bestValue,
        })),
      };
    });

    res.json({
      success: true,
      data: {
        proposals: ordered.map((p) => ({
          id: p.id,
          status: p.status,
          createdAt: p.createdAt,
          label: `Option - ${p.systemSizeKw} kW`,
        })),
        rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProposalAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, sent, accepted, allDetails] = await Promise.all([
      prisma.solarProposal.count(),
      prisma.solarProposal.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.solarProposal.count({ where: { status: ProposalStatus.SENT } }),
      prisma.solarProposal.count({ where: { status: ProposalStatus.ACCEPTED } }),
      prisma.solarProposal.findMany({
        select: {
          systemSizeKw: true,
          netCost: true,
          panelBrand: true,
          status: true,
          sentAt: true,
        },
      }),
    ]);

    const avgSystemKw = allDetails.length
      ? +(allDetails.reduce((s, p) => s + p.systemSizeKw, 0) / allDetails.length).toFixed(2)
      : 0;

    const avgDealValue = allDetails.length
      ? Math.round(allDetails.reduce((s, p) => s + p.netCost, 0) / allDetails.length)
      : 0;

    const brandCount: Record<string, number> = {};
    for (const p of allDetails) brandCount[p.panelBrand] = (brandCount[p.panelBrand] || 0) + 1;
    const topBrand = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    const buckets: Record<string, number> = { '1-2 kW': 0, '2-3 kW': 0, '3-5 kW': 0, '5-10 kW': 0, '>10 kW': 0 };
    for (const p of allDetails) {
      const kw = p.systemSizeKw;
      if (kw <= 2) buckets['1-2 kW']++;
      else if (kw <= 3) buckets['2-3 kW']++;
      else if (kw <= 5) buckets['3-5 kW']++;
      else if (kw <= 10) buckets['5-10 kW']++;
      else buckets['>10 kW']++;
    }

    res.json({
      success: true,
      data: {
        total,
        thisMonth,
        conversionRate: total > 0 ? +((accepted / total) * 100).toFixed(1) : 0,
        sentRate: total > 0 ? +((sent / total) * 100).toFixed(1) : 0,
        avgSystemKw,
        avgDealValue,
        topBrand,
        sizeBuckets: buckets,
        avgConversionDays: null,
        acceptedCount: accepted,
      },
    });
  } catch (err) {
    next(err);
  }
};
