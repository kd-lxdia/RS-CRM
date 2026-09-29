import { PrismaClient } from '@prisma/client';
import { createNotification } from './notification-generator.service';

const prisma = new PrismaClient();

export async function checkAndNotifyLowStock() {
  try {
    // Find items where current quantity is at or below threshold
    const lowStockItems = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      unit: string;
      lowStockThreshold: number;
      dealerId: string | null;
    }>>`
      SELECT id, name, sku, quantity, unit, "lowStockThreshold", "dealerId"
      FROM "StockItem"
      WHERE quantity <= "lowStockThreshold"
    `;

    if (lowStockItems.length === 0) return;

    // Get all warehouse staff
    const warehouseStaff = await prisma.user.findMany({
      where: {
        role: 'WAREHOUSE',
        isActive: true
      }
    });

    // Get all admins
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true
      }
    });

    // Notify warehouse staff about each low stock item
    for (const staff of warehouseStaff) {
      for (const item of lowStockItems) {
        await createNotification({
          userId: staff.id,
          type: 'LOW_STOCK',
          title: 'Low Stock Alert',
          message: `Stock item "${item.name}" (SKU: ${item.sku}) is running low. Current: ${item.quantity} ${item.unit}, Threshold: ${item.lowStockThreshold} ${item.unit}`,
          entityType: 'STOCK_ITEM',
          entityId: item.id
        });
      }
    }

    // Notify admins with summary
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'LOW_STOCK_SUMMARY',
        title: 'Low Stock Summary',
        message: `${lowStockItems.length} item(s) are running low on stock. Please review inventory levels.`,
        entityType: 'STOCK',
        entityId: 'summary'
      });
    }

    console.log(`Sent low stock notifications for ${lowStockItems.length} items`);
  } catch (error) {
    console.error('Error checking low stock:', error);
  }
}