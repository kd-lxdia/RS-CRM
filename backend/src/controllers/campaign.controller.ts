import { Request, Response, NextFunction } from 'express';
import { prisma, emailQueue, whatsappQueue } from '../lib/clients';
import { AuthenticatedRequest } from '../middlewares/auth';

// GET /api/campaigns
export const listCampaigns = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, type, startDate, endDate, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: { template: { select: { name: true, type: true } }, creator: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ success: true, data: { campaigns, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) { next(err); }
};

// POST /api/campaigns
export const createCampaign = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type, templateId, scheduledAt } = req.body;
    const campaign = await prisma.campaign.create({
      data: {
        name, type, templateId,
        createdBy: req.user!.id,
        dealerId: req.user?.dealerId ?? null,
        startedAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (err) { next(err); }
};

// GET /api/campaigns/:id
export const getCampaign = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, ...(req.user?.dealerId ? { dealerId: req.user.dealerId } : {}) },
      include: {
        template: true,
        creator: { select: { name: true, role: true } },
        rawLeads: { select: { id: true, name: true, phone: true, status: true } },
      },
    });
    if (!campaign) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    res.json({ success: true, data: campaign });
  } catch (err) { next(err); }
};

// PATCH /api/campaigns/:id/status
export const updateCampaignStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, ...(req.user?.dealerId ? { dealerId: req.user.dealerId } : {}) },
    });
    if (!campaign) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });

    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'RUNNING' && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });

    // Enqueue job when starting
    if (status === 'RUNNING') {
      if (campaign.type === 'WHATSAPP' || campaign.type === 'BOTH') {
        await whatsappQueue.add('send-whatsapp', { campaignId: campaign.id });
      }
      if (campaign.type === 'EMAIL' || campaign.type === 'BOTH') {
        await emailQueue.add('send-email', { campaignId: campaign.id });
      }
    }

    res.json({ success: true, data: updatedCampaign });
  } catch (err) { next(err); }
};

// DELETE /api/campaigns/:id
export const deleteCampaign = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, ...(req.user?.dealerId ? { dealerId: req.user.dealerId } : {}) },
    });
    if (!campaign) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    if (campaign.status !== 'DRAFT') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Only DRAFT campaigns can be deleted' } });
    }
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
