import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth';
import { parse } from 'json2csv';

const prisma = new PrismaClient();

// --- ACCOUNTS ENDPOINTS ---

export const getSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};

    const [totalRevRes, monthCollectedRes, overdues, avgDealRes, totalCust] = await Promise.all([
      // totalRevenue
      prisma.payment.aggregate({
        where: { customer: dealerFilter },
        _sum: { amount: true }
      }),
      // thisMonthCollected
      prisma.payment.aggregate({
        where: { 
          customer: dealerFilter,
          paymentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } 
        },
        _sum: { amount: true }
      }),
      // overdue
      prisma.invoice.aggregate({
        where: { status: 'OVERDUE', customer: dealerFilter },
        _sum: { totalAmount: true },
        _count: { id: true }
      }),
      // avgDealValue
      prisma.solarProposal.aggregate({
        where: { status: 'ACCEPTED', customer: dealerFilter },
        _avg: { totalCost: true }
      }),
      // totalCustomers
      prisma.customer.count({
        where: { ...dealerFilter }
      })
    ]);

    // calculate total outstanding
    const pendingInvoices = await prisma.invoice.aggregate({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, customer: dealerFilter },
      _sum: { totalAmount: true } // Simplified outstanding calculation. Proper logic requires tracking (totalAmount - amoountPaid).
    });

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevRes._sum?.amount || 0,
        thisMonthCollected: monthCollectedRes._sum?.amount || 0,
        totalOutstanding: pendingInvoices._sum?.totalAmount || 0,
        overdueCount: overdues._count.id || 0,
        overdueAmount: overdues._sum.totalAmount || 0,
        avgDealValue: avgDealRes._avg.totalCost || 0,
        totalCustomers: totalCust
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getReceivables = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};
    
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, customer: dealerFilter },
      include: { customer: true }
    });

    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const grouped = {
      overdue: invoices.filter(i => i.status === 'OVERDUE' || (i.dueDate && new Date(i.dueDate) < now)),
      dueThisWeek: invoices.filter(i => i.dueDate && new Date(i.dueDate) >= now && new Date(i.dueDate) <= oneWeek),
      dueThisMonth: invoices.filter(i => i.dueDate && new Date(i.dueDate) > oneWeek && new Date(i.dueDate) <= oneMonth),
      future: invoices.filter(i => i.dueDate && new Date(i.dueDate) > oneMonth || !i.dueDate)
    };

    res.json({ success: true, data: grouped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getMonthlyCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const payments = await prisma.payment.findMany({
      where: { customer: dealerFilter, paymentDate: { gte: oneYearAgo } },
      select: { amount: true, paymentDate: true }
    });

    const monthlyMap = new Map();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize exactly last 12 trailing months
    let curr = new Date(oneYearAgo);
    for (let i = 0; i < 12; i++) {
        curr.setMonth(curr.getMonth() + 1);
        const label = `${months[curr.getMonth()]} ${curr.getFullYear().toString().substring(2)}`;
        monthlyMap.set(label, 0);
    }

    for (const p of payments) {
      if (!p.paymentDate) continue;
      const d = new Date(p.paymentDate);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      if (monthlyMap.has(label)) {
        monthlyMap.set(label, monthlyMap.get(label) + Number(p.amount));
      }
    }

    const data = Array.from(monthlyMap, ([month, collection]) => ({ month, collection }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCustomerFinancials = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        payments: { orderBy: { paymentDate: 'desc' } },
        invoices: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- INVOICE ENDPOINTS ---

export const getInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};
    const invoices = await prisma.invoice.findMany({
      where: { customer: dealerFilter },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: invoices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ success: false, error: 'Only DRAFT invoices can be updated' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const markInvoiceOverdue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'OVERDUE' }
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- PAYMENTS ENDPOINTS ---

export const getPaymentsReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};
    const payments = await prisma.payment.findMany({
      where: { customer: dealerFilter },
      include: { customer: { select: { name: true } } },
      orderBy: { paymentDate: 'desc' }
    });
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const exportPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealerFilter = req.user!.dealerId ? { dealerId: req.user!.dealerId } : {};
    const payments = await prisma.payment.findMany({
      where: { customer: dealerFilter },
      include: { customer: { select: { name: true } } },
      orderBy: { paymentDate: 'desc' }
    });

    const flatRecords = payments.map(p => ({
      customer_name: p.customer.name,
      amount: p.amount,
      milestone: p.milestone,
      status: p.mode,
      date: p.paymentDate?.toISOString().split('T')[0],
      reference: p.transactionRef
    }));

    if (flatRecords.length === 0) {
      return res.status(400).json({ success: false, error: 'No data to export' });
    }

    const csv = parse(flatRecords);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('payments_export.csv');
    res.send(csv);

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
