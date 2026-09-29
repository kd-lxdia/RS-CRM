import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export const getMyCustomers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // "customers assigned to logged-in installer where documentation is complete (all green)"
    // Documentation complete implies docChecklist.completedAt is not null or status="ACTIVE"
    const whereClause: any = {
      docChecklist: {
        completedAt: { not: null }
      },
      status: { in: ['ACTIVE', 'INSTALLATION_DONE'] }
    };
    
    if (req.user!.role === UserRole.INSTALLATION) {
      whereClause.assignedInstallation = userId;
    } else {
      whereClause.assignedInstallation = { not: null };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        siteSurveys: true,
        docChecklist: true,
        visits: {
          where: { visitType: 'SITE_SURVEY' },
          orderBy: { scheduledAt: 'desc' },
          take: 1
        }
      }
    });

    res.json({ success: true, data: customers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getMyRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = dayjs().format('YYYY-MM-DD');
    
    // Get all visits (site surveys and installations) scheduled for today for this installer
    const visits = await prisma.visit.findMany({
      where: {
        assignedTo: userId,
        visitDate: {
          gte: new Date(today + 'T00:00:00Z'),
          lt: new Date(dayjs(today).add(1, 'day').format('YYYY-MM-DD') + 'T00:00:00Z')
        },
        visitType: { in: ['SITE_SURVEY', 'INSTALLATION'] }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    // Transform to route format
    const route = visits.map(v => ({
      id: v.id,
      customerId: v.customerId,
      leadId: v.leadId,
      name: v.customer?.name || v.lead?.name || 'Unknown',
      phone: v.customer?.phone || v.lead?.phone || '',
      address: v.customer?.address || v.lead?.address || '',
      lat: v.customer?.latitude || v.lead?.latitude || null,
      lng: v.customer?.longitude || v.lead?.longitude || null,
      scheduledAt: v.scheduledAt,
      status: v.status,
      type: v.visitType
    }));

    res.json({ success: true, data: route });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const completeSite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { siteId } = req.params;
    const { notes } = req.body;

    const visit = await prisma.visit.findUnique({
      where: { id: siteId },
      include: { customer: true, lead: true }
    });

    if (!visit) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }

    // Update visit status
    await prisma.visit.update({
      where: { id: siteId },
      data: {
        status: 'COMPLETED',
        notes: notes || visit.notes
      }
    });

    // If it's an installation visit, also update customer status
    if (visit.visitType === 'INSTALLATION' && visit.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: visit.customerId },
        include: { payments: true }
      });

      if (customer) {
        const isFinalPaymentCleared = customer.payments.some(p => p.milestone === 'FINAL');
        const newStatus = isFinalPaymentCleared ? 'COMPLETED' : 'INSTALLATION_DONE';

        await prisma.customer.update({
          where: { id: visit.customerId },
          data: { status: newStatus }
        });

        // Notify accountant
        if (customer.assignedAccountant) {
          await prisma.notification.create({
            data: {
              userId: customer.assignedAccountant,
              type: 'FINAL_PAYMENT_DUE',
              title: 'Installation Complete - Final Payment Due',
              message: `Installation for ${customer.name} is complete. Final payment milestone triggered.`,
              entityType: 'CUSTOMER',
              entityId: visit.customerId
            }
          });
        }

        await prisma.timelineEvent.create({
          data: {
            customerId: visit.customerId,
            eventType: 'INSTALLATION_COMPLETED',
            description: `Installation marked complete by ${req.user!.id}. Notes: ${notes || 'None'}`,
            performedBy: req.user!.id
          }
        });
      }
    }

    res.json({ success: true, data: { message: 'Site work completed successfully' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const completeInstallation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { payments: true }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Mark installation done
    // If final payment already cleared -> sets status to COMPLETED
    // For mock logic, assuming checking if total payment >= expected. Using a simplified flag here.
    const isFinalPaymentCleared = customer.payments.some(p => p.milestone === 'FINAL');
    
    const newStatus = isFinalPaymentCleared ? 'COMPLETED' : 'INSTALLATION_DONE';

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { status: newStatus }
    });

    // Notify accountant
    if (customer.assignedAccountant) {
      await prisma.notification.create({
        data: {
          userId: customer.assignedAccountant,
          type: 'FINAL_PAYMENT_DUE',
          title: 'Installation Complete - Final Payment Due',
          message: `Installation for ${customer.name} is complete. Final payment milestone triggered.`,
          entityType: 'CUSTOMER',
          entityId: customerId
        }
      });
    }

    await prisma.timelineEvent.create({
      data: {
        customerId,
        eventType: 'INSTALLATION_COMPLETED',
        description: `Installation marked complete by ${req.user!.id}`,
        performedBy: req.user!.id
      }
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
