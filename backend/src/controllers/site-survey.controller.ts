import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const createSiteSurvey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      customerId, visitId, roofDimensions, roofType, 
      shadowAnalysis, panelCount, inverterCount, 
      inverterModel, structureDetails, cableLength, 
      earthingRequired, specialNotes, items 
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create survey
      const survey = await tx.siteSurvey.create({
        data: {
          customerId,
          visitId,
          conductedBy: req.user!.id,
          roofDimensions: roofDimensions || {},
          roofType,
          shadowAnalysis,
          panelCount,
          inverterCount,
          inverterModel,
          structureDetails,
          cableLength,
          earthingRequired,
          specialNotes,
          bomGenerated: true,
          completedAt: new Date()
        }
      });

      // 2. Create BOMItems
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await tx.bOMItem.create({
            data: {
              siteSurveyId: survey.id,
              customerId,
              itemName: item.itemName,
              sku: item.sku,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              status: 'PENDING'
            }
          });
        }
      }

      // 3. Update Visit status
      await tx.visit.update({
        where: { id: visitId },
        data: { status: 'COMPLETED' }
      });

      // 4. Create TimelineEvent
      await tx.timelineEvent.create({
        data: {
          customerId,
          eventType: 'SITE_SURVEY_COMPLETED',
          description: `Site survey completed and BOM generated.`,
          performedBy: req.user!.id
        }
      });

      // 5. Notify warehouse
      const warehouseUsers = await tx.user.findMany({
        where: { role: 'WAREHOUSE', isActive: true }
      });

      for (const wu of warehouseUsers) {
        await tx.notification.create({
          data: {
            userId: wu.id,
            type: 'NEW_BOM',
            title: 'New BOM Generated',
            message: `A new BOM has been generated for customer ${customerId}. Allocation needed.`,
            entityType: 'CUSTOMER',
            entityId: customerId
          }
        });
      }

      return survey;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getSiteSurvey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const surveys = await prisma.siteSurvey.findMany({
      where: { customerId },
      include: { bomItems: true },
      orderBy: { completedAt: 'desc' }
    });
    // Return latest or array
    res.json({ success: true, data: surveys[0] || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSiteSurvey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingSurvey = await prisma.siteSurvey.findUnique({
      where: { id },
      include: { customer: { include: { dispatches: true } } }
    });

    if (!existingSurvey) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }

    // Check if dispatch has started
    const hasDispatch = existingSurvey.customer?.dispatches?.some(d => d.status !== 'PENDING');
    if (hasDispatch) {
      return res.status(400).json({ success: false, error: 'Cannot update survey after dispatch has started' });
    }

    const updated = await prisma.siteSurvey.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
