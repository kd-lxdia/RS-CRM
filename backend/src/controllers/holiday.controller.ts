import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    let whereClause = {};

    if (month && year) {
      const m = parseInt(month as string).toString().padStart(2, '0');
      whereClause = {
        date: {
          startsWith: `${year}-${m}`
        }
      };
    }

    const holidays = await prisma.holiday.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });

    res.json({ success: true, data: holidays });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createHoliday = async (req: Request, res: Response) => {
  try {
    const { date, name } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ success: false, message: 'Date and Name required' });
    }

    const holiday = await prisma.holiday.create({
      data: { date, name }
    });

    res.json({ success: true, data: holiday, message: 'Holiday added' });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Holiday already exists for this date' });
    }
    console.error('Error creating holiday:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.holiday.delete({ where: { id } });
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
