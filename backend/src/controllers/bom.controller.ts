import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const getBOM = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    const bomItems = await prisma.bOMItem.findMany({
      where: { customerId }
    });

    // Need to fetch matching StockItem records based on sku
    // Doing application-level join
    if (bomItems.length > 0) {
      const skus = bomItems.map(b => b.sku);
      const stockItems = await prisma.stockItem.findMany({
        where: { sku: { in: skus } }
      });

      const stockMap = new Map(stockItems.map(s => [s.sku, s]));

      const formatted = bomItems.map(item => {
         const st = stockMap.get(item.sku);
         return {
           ...item,
           availableQty: st ? st.quantity : 0
         };
      });

      return res.json({ success: true, data: formatted });
    }

    res.json({ success: true, data: bomItems });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateBOMItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await prisma.bOMItem.update({
      where: { id },
      data: updates
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
