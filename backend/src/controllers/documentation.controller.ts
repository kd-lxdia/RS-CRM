import { Response } from 'express';
import { PrismaClient, AppStatus, LoanStatus } from '../lib/prisma-client-shim';
import { AuthenticatedRequest } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const prisma = new PrismaClient();

export const getMyCustomers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const dealerId = req.user!.dealerId;

    const where: any = {};
    if (req.user!.role === UserRole.DOCUMENTATION) {
      where.assignedDocumentation = userId; // Only assigned to this officer
    } else {
      where.assignedDocumentation = { not: null }; // For Admin/ProjectHead to see all documentation tasks
    }

    if (dealerId) where.dealerId = dealerId;

    const customers = await prisma.customer.findMany({
      where,
      include: {
        docChecklist: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate completion %
    const formatted = customers.map(c => {
      let total = 0;
      let completed = 0;
      if (c.docChecklist) {
        total += 1; // PM Surya Ghar
        if (c.docChecklist.pmSuryaStatus === 'APPROVED') completed++;

        if (c.docChecklist.cmSchemeApplicable) {
          total += 1;
          if (c.docChecklist.cmSchemeStatus === 'APPROVED') completed++;
        }

        if (c.docChecklist.loanApplicable) {
          total += 1;
          if (c.docChecklist.loanStatus === 'DISBURSED') completed++;
        }

        total += 1; // Net Metering
        if (c.docChecklist.netMeteringStatus === 'APPROVED') completed++;
      }

      const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...c,
        completionPercentage
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getChecklist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    let checklist = await prisma.documentationChecklist.findUnique({
      where: { customerId }
    });

    if (!checklist) {
      // Create a default one if it doesn't exist
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

      checklist = await prisma.documentationChecklist.create({
        data: {
          customerId,
          assignedTo: customer.assignedDocumentation || req.user!.id
        }
      });
    }

    res.json({ success: true, data: checklist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateChecklist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const updates = req.body; // { pmSuryaAppNo, pmSuryaStatus, ... }

    const checklist = await prisma.documentationChecklist.findUnique({
      where: { customerId }
    });

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' });
    }

    const updatedChecklist = await prisma.documentationChecklist.update({
      where: { customerId },
      data: updates
    });

    // Check if fully complete
    let total = 1 + 1; // pmSurya + netMetering minimum
    if (updatedChecklist.cmSchemeApplicable) total++;
    if (updatedChecklist.loanApplicable) total++;

    let completed = 0;
    if (updatedChecklist.pmSuryaStatus === 'APPROVED') completed++;
    if (updatedChecklist.netMeteringStatus === 'APPROVED') completed++;
    if (updatedChecklist.cmSchemeApplicable && updatedChecklist.cmSchemeStatus === 'APPROVED') completed++;
    if (updatedChecklist.loanApplicable && updatedChecklist.loanStatus === 'DISBURSED') completed++;

    const isComplete = total === completed;

    if (isComplete && !checklist.completedAt) {
      // Just became complete
      await prisma.documentationChecklist.update({
        where: { customerId },
        data: { completedAt: new Date() }
      });

      // Update Customer Status
      await prisma.customer.update({
        where: { id: customerId },
        data: { status: 'ACTIVE' } // Depending on your business logic
      });

      // Emit Notification (mocked here, add actual notification logic)
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'DOCUMENTATION_COMPLETE',
          title: 'Documentation Completed',
          message: `All documentation for customer ${customerId} is completed.`,
          entityType: 'CUSTOMER',
          entityId: customerId
        }
      });
    }

    // Log a timeline event
    await prisma.timelineEvent.create({
      data: {
        customerId,
        eventType: 'DOCUMENTATION_UPDATED',
        description: `Documentation checklist updated by ${req.user!.id}`,
        performedBy: req.user!.id
      }
    });

    res.json({ success: true, data: updatedChecklist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
