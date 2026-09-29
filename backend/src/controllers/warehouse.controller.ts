import { Response } from 'express';
import { PrismaClient, TxType } from '../lib/prisma-client-shim';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

// --- STOCK ENDPOINTS ---

export const getStock = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stockItems = await prisma.stockItem.findMany({
      where: req.user!.dealerId ? { dealerId: req.user!.dealerId } : {},
      orderBy: { name: 'asc' }
    });

    const formatted = stockItems.map(item => ({
      ...item,
      isLowStock: item.quantity <= item.lowStockThreshold,
      isOutOfStock: item.quantity <= 0
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createStockItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sku, category, lowStockThreshold, unit } = req.body;
    
    // Check if SKU exists
    const exists = await prisma.stockItem.findUnique({ where: { sku } });
    if (exists) {
      return res.status(400).json({ success: false, error: 'SKU already exists' });
    }

    const newItem = await prisma.stockItem.create({
      data: {
        name,
        sku,
        category,
        lowStockThreshold: Number(lowStockThreshold),
        unit,
        quantity: 0,
        dealerId: req.user!.dealerId
      }
    });

    res.json({ success: true, data: newItem });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateStockItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, lowStockThreshold, unit } = req.body;

    const updated = await prisma.stockItem.update({
      where: { id },
      data: {
        name,
        category,
        lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : undefined,
        unit
      }
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: stockItemId } = req.params;
    const { type, quantity, reference, notes, customerId } = req.body;

    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ success: false, error: 'Quantity must be positive' });

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item) throw new Error('Stock item not found');

      if (type === 'OUT' && item.quantity < qty) {
        throw new Error(`Insufficient stock. Available: ${item.quantity}`);
      }

      const multiplier = type === 'OUT' ? -1 : type === 'IN' ? 1 : (qty < 0 ? -1 : 1); // For adjustment, assuming qty can be signed if we change API, but spec says just adjust. Let's assume adjustment can just set or add. Spec says: OUT <= current stock.
      // So ADJ is explicitly given a positive qty and maybe we need to specify if it's add/subtract. 
      // Let's assume 'IN' +qty, 'OUT' -qty, 'ADJUSTMENT' can be whatever logic applies. We will treat ADJUSTMENT as modifying by +qty for now or explicit absolute set if handled differently. Let's do simple increment/decrement.
      const actualQtyDelta = type === 'OUT' ? -qty : qty; // Assume adjustment is adding? Or maybe ADJUSTMENT can be anything. We'll use actualQtyDelta.

      const updatedItem = await tx.stockItem.update({
        where: { id: stockItemId },
        data: { quantity: { increment: actualQtyDelta } }
      });

      const transaction = await tx.stockTransaction.create({
        data: {
          stockItemId,
          type: type as TxType,
          quantity: qty,
          reference,
          notes,
          customerId,
          performedBy: req.user!.id
        }
      });

      // Notification
      if (updatedItem.quantity < updatedItem.lowStockThreshold) {
        const adminsAndWarehouse = await tx.user.findMany({
          where: { role: { in: ['ADMIN', 'WAREHOUSE'] }, isActive: true }
        });

        for (const u of adminsAndWarehouse) {
          await tx.notification.create({
            data: {
              userId: u.id,
              type: 'LOW_STOCK',
              title: `Low Stock Alert: ${updatedItem.sku}`,
              message: `Item ${updatedItem.name} has fallen below threshold. Current Qty: ${updatedItem.quantity}.`,
              entityType: 'STOCK_ITEM',
              entityId: stockItemId
            }
          });
        }
      }

      return { transaction, updatedItem };
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// --- PIPELINE ENDPOINTS ---

export const getPipeline = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Customers with BOM submitted => SiteSurveys that are completed / true
    const surveys = await prisma.siteSurvey.findMany({
      where: { bomGenerated: true },
      include: {
        customer: true,
        bomItems: true
      }
    });

    const skus = Array.from(new Set(surveys.flatMap(s => s.bomItems.map(b => b.sku))));
    const stockItems = await prisma.stockItem.findMany({
      where: { sku: { in: skus } }
    });
    const stockMap = new Map(stockItems.map(s => [s.sku, s]));

    const pipeline = surveys.map(survey => {
      let allGreen = true;
      let hasRed = false;
      let blockedBy: Array<{ itemName: string; sku: string; required: number; available: number }> = [];

      const enrichedBOM = survey.bomItems.map(item => {
        const stock = stockMap.get(item.sku);
        const availableQty = stock ? stock.quantity : 0;
        const sufficient = availableQty >= item.quantity;
        
        if (!sufficient) {
          allGreen = false;
          hasRed = true;
          blockedBy.push({
            itemName: item.itemName,
            sku: item.sku,
            required: item.quantity,
            available: availableQty
          });
        }

        return {
          ...item,
          availableQty,
          status: sufficient ? 'GREEN' : 'RED'
        };
      });

      let status = 'READY_TO_DISPATCH';
      if (!allGreen && survey.bomItems.length > 0) {
        // If some are sufficient, it's PARTIAL. If none or all red, or missing one - let's classify carefully.
        // "PARTIAL: some items in stock"
        // "BLOCKED: items out of stock"
        // Wait, if ANY are missing, it's blocked from FULL dispatch. But spec says:
        // PRE-CONDITION dispatch: ALL BOM items must have sufficient stock. 
        // We will classify PARTIAL if > 0 items are GREEN and > 0 RED. BLOCKED if ALL RED.
        const greenCount = enrichedBOM.filter(i => i.status === 'GREEN').length;
        if (greenCount === 0) {
          status = 'BLOCKED';
        } else {
          status = 'PARTIAL';
        }
      }

      return {
        customer: survey.customer,
        surveyId: survey.id,
        items: enrichedBOM,
        pipelineStatus: status,
        blockedBy
      };
    });

    res.json({ success: true, data: pipeline });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const dispatchCustomer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    // Atomically deduct properties
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get BOM items
      const surveys = await tx.siteSurvey.findMany({
        where: { customerId, bomGenerated: true },
        include: { bomItems: { where: { status: 'PENDING' } } }
      });

      if (surveys.length === 0 || surveys[0].bomItems.length === 0) {
        throw new Error('No pending BOM items found for dispatch');
      }

      const items = surveys[0].bomItems;

      // 2. Map required and validate stock
      // Deduct items from stock
      const dispatchedItemsLog = [];

      for (const item of items) {
        const stockItem = await tx.stockItem.findUnique({ where: { sku: item.sku } });
        if (!stockItem || stockItem.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.itemName} (${item.sku}). Blocking dispatch.`);
        }

        // Deduct
        await tx.stockItem.update({
          where: { sku: item.sku },
          data: { quantity: { decrement: item.quantity } }
        });

        // Stock Transaction
        await tx.stockTransaction.create({
          data: {
            stockItemId: stockItem.id,
            type: 'OUT',
            quantity: item.quantity,
            reference: `DISPATCH-${customerId}`,
            notes: 'Dispatch deduction',
            customerId,
            performedBy: req.user!.id
          }
        });

        // Update BOMItem
        await tx.bOMItem.update({
          where: { id: item.id },
          data: { status: 'DISPATCHED' }
        });

        dispatchedItemsLog.push({ itemName: item.itemName, sku: item.sku, quantity: item.quantity });
      }

      // 3. Create dispatch record
      const dispatch = await tx.dispatch.create({
        data: {
          customerId,
          dispatchedBy: req.user!.id,
          status: 'DISPATCHED',
          items: dispatchedItemsLog,
          dispatchedAt: new Date(),
          notes: 'Standard sequential dispatch'
        }
      });

      // 4. Update timeline & Notify
      await tx.timelineEvent.create({
        data: {
          customerId,
          eventType: 'MATERIAL_DISPATCHED',
          description: `Materials dispatched by ${req.user!.id}`,
          performedBy: req.user!.id
        }
      });

      const installers = await tx.user.findMany({
        where: { role: 'INSTALLATION', isActive: true, instCustomers: { some: { id: customerId } } }
      });

      for (const inst of installers) {
        await tx.notification.create({
          data: {
            userId: inst.id,
            type: 'DISPATCH_ARRIVING',
            title: 'Materials Dispatched',
            message: `Material dispatch confirmed for Customer ${customerId}.`,
            entityType: 'CUSTOMER',
            entityId: customerId
          }
        });
      }

      return dispatch;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message.includes('Insufficient stock')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- ALERTS ENDPOINT ---

export const getAlerts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stockItems = await prisma.stockItem.findMany();
    const belowThreshold = stockItems.filter(i => i.quantity <= i.lowStockThreshold && i.quantity > 0);
    const zeroStock = stockItems.filter(i => i.quantity <= 0);

    // Find blocked customers (same logic as pipeline)
    const surveys = await prisma.siteSurvey.findMany({
      where: { bomGenerated: true },
      include: { customer: true, bomItems: { where: { status: 'PENDING' } } }
    });

    const blockedCustomers = [];
    for (const survey of surveys) {
      if (survey.bomItems.length > 0) {
        let isBlocked = false;
        let blockingItems = [];
        for (const item of survey.bomItems) {
            const st = stockItems.find(s => s.sku === item.sku);
            const av = st ? st.quantity : 0;
            if (av < item.quantity) {
              isBlocked = true;
              blockingItems.push({ sku: item.sku, req: item.quantity, av });
            }
        }
        if (isBlocked && survey.customer) {
          blockedCustomers.push({ customer: survey.customer, tracking: blockingItems });
        }
      }
    }

    res.json({
      success: true,
      data: {
        belowThreshold,
        zeroStock,
        blockedCustomers
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
