import { Response } from 'express';
import { prisma } from '../lib/clients';
import { AuthenticatedRequest } from '../middlewares/auth';

export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.query;
    const where: any = { isActive: true };

    if (role) where.role = role;
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        dealerId: true,
        zoneId: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};


export const updateUserPreferences = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { language } = req.body;
    const userId = req.user!.id;

    // Validate language
    if (language && !['en', 'hi'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_LANGUAGE', message: 'Language must be either "en" or "hi"' },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { language },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        language: true,
      },
    });

    res.json({ success: true, data: updatedUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};

export const getUserPreferences = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        language: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
};
