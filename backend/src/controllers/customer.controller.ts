import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';

const prisma = new PrismaClient();

export const listCustomers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    const userId = req.user!.id;

    const where: any = {};

    if (dealerId) {
      where.dealerId = dealerId;
    }

    if (req.user?.role === UserRole.SALESPERSON) {
      where.assignedSalesperson = userId;
    }

    if (req.user?.role === UserRole.DOCUMENTATION) {
      where.assignedDocumentation = userId;
    }

    if (req.user?.role === UserRole.INSTALLATION) {
      where.assignedInstallation = userId;
    }

    if (req.user?.role === UserRole.ACCOUNTANT) {
      where.assignedAccountant = userId;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        salesperson: { select: { name: true } },
        documentationUser: { select: { name: true } },
        installationUser: { select: { name: true } },
        accountantUser: { select: { name: true } },
        zone: { select: { name: true } },
        docChecklist: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCustomerById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id;
    const dealerId = req.user?.dealerId;

    const where: any = { id: customerId };

    // Apply dealer scoping if user has a dealerId
    if (dealerId) {
      where.dealerId = dealerId;
    }

    const customer = await prisma.customer.findFirst({
      where,
      include: {
        salesperson: { select: { id: true, name: true, email: true, phone: true } },
        documentationUser: { select: { id: true, name: true, email: true, phone: true } },
        installationUser: { select: { id: true, name: true, email: true, phone: true } },
        accountantUser: { select: { id: true, name: true, email: true, phone: true } },
        zone: { select: { id: true, name: true, city: true } },
        docChecklist: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const assignDocumentation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id;
    const { documentationOfficerId } = req.body;

    // Must be Admin or Project Head
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.PROJECT_HEAD)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Assign officer
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: { assignedDocumentation: documentationOfficerId }
    });

    // Also update checklist assignedTo if exists
    await prisma.documentationChecklist.updateMany({
      where: { customerId: customerId },
      data: { assignedTo: documentationOfficerId }
    });
    
    // Log timeline event
    await prisma.timelineEvent.create({
      data: {
        customerId,
        eventType: 'ASSIGNMENT_CHANGED',
        description: `Documentation officer manually reassigned.`,
        performedBy: req.user.id
      }
    });

    res.json({ success: true, data: updatedCustomer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
