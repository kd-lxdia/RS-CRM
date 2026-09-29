import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const getSetting = async (req: AuthenticatedRequest, res: Response) => {
  const { key } = req.params;

  const setting = await prisma.systemSetting.findUnique({
    where: { key }
  });

  if (!setting) {
    return res.status(404).json({ success: false, message: 'Setting not found' });
  }

  res.json({ success: true, data: setting });
};

export const updateSetting = async (req: AuthenticatedRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  const userId = req.user?.id; // Assuming user is attached

  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value, updatedBy: userId },
    create: { key, value, updatedBy: userId }
  });

  res.json({ success: true, data: setting });
};

export const getAllSettings = async (_req: AuthenticatedRequest, res: Response) => {
  const settings = await prisma.systemSetting.findMany();
  res.json({ success: true, data: settings });
};
