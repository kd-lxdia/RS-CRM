import { Request, Response } from 'express';
import { prisma } from '../lib/clients';
import { AuthenticatedRequest } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const getDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const customerCount = await prisma.customer.count({ where: { dealerId } });
    const leadCount = await prisma.lead.count({ where: { dealerId } });
    const teamCount = await prisma.user.count({ where: { dealerId, isActive: true } });

    // Revenue from COMPLETED invoices for this dealer
    const invoices = await prisma.invoice.aggregate({
      where: { customer: { dealerId }, status: 'PAID' as any },
      _sum: { totalAmount: true },
    });

    res.json({
      success: true,
      data: {
        customerCount,
        leadCount,
        teamCount,
        revenue: invoices._sum.totalAmount || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const team = await prisma.user.findMany({
      where: { dealerId, isActive: true },
      select: { id: true, name: true, email: true, phone: true, role: true, zoneId: true, createdAt: true },
    });

    res.json({ success: true, data: team });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const { name, email, phone, role, zoneId } = req.body;

    // DEALER_ADMIN cannot spawn other DEALER_ADMINs
    const allowedRoles = [
      'CALLING_STAFF', 'SALESPERSON', 'DOCUMENTATION', 
      'INSTALLATION', 'WAREHOUSE', 'ACCOUNTANT', 'DEALER_STAFF'
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role for dealer team' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ success: false, error: 'Email already in use' });

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: role as UserRole,
        dealerId,
        zoneId,
      },
    });

    // TODO: Send welcome email with tempPassword

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    const { id } = req.params;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.dealerId !== dealerId) {
      return res.status(404).json({ success: false, error: 'User not found in your team' });
    }

    const { name, phone, role, zoneId } = req.body;
    
    // Prevent escalating role
    const allowedRoles = [
      'CALLING_STAFF', 'SALESPERSON', 'DOCUMENTATION', 
      'INSTALLATION', 'WAREHOUSE', 'ACCOUNTANT', 'DEALER_STAFF'
    ];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role assignment' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, phone, role: role as UserRole, zoneId },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deactivateTeamMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    const { id } = req.params;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.dealerId !== dealerId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (existing.role === 'DEALER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot deactivate prime dealer admin' });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, data: { message: 'User deactivated' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { id: true, companyName: true, contactName: true, email: true, phone: true, address: true, isActive: true },
    });

    res.json({ success: true, data: dealer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerId = req.user?.dealerId;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Not a dealer' });

    const { companyName, contactName, email, phone, address, isActive } = req.body;

    const updated = await prisma.dealer.update({
      where: { id: dealerId },
      data: { companyName, contactName, email, phone, address, isActive },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
