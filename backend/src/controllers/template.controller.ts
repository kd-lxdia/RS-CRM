import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { AuthenticatedRequest } from '../middlewares/auth';

export const listTemplates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const templates = await prisma.campaignTemplate.findMany({ where, orderBy: { id: 'asc' } });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
};

export const createTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type, subject, body, variables } = req.body;
    const template = await prisma.campaignTemplate.create({
      data: { name, type, subject, body, variables, createdBy: req.user!.id, dealerId: req.user?.dealerId ?? null },
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
};

export const getTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const template = await prisma.campaignTemplate.findFirst({ where });
    if (!template) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

export const updateTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const existing = await prisma.campaignTemplate.findFirst({ where });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    const { name, type, subject, body, variables } = req.body;
    const template = await prisma.campaignTemplate.update({
      where: { id: req.params.id },
      data: { name, type, subject, body, variables },
    });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

export const deleteTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const existing = await prisma.campaignTemplate.findFirst({ where });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    await prisma.campaignTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
