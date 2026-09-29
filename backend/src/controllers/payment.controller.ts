import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';

// ─── List payments for customer ───────────────────────────────────────────────

export const getCustomerPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { paymentDate: 'desc' },
      include: { recorder: { select: { name: true } } },
    });
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
};

// ─── Record a payment ─────────────────────────────────────────────────────────

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, invoiceId, amount, mode, transactionRef, milestone, notes } = req.body;
    const recordedBy = (req as any).user.id;

    if (!customerId || !amount || !mode || !milestone) {
      return res.status(400).json({ success: false, error: { message: 'customerId, amount, mode, milestone required' } });
    }

    const payment = await prisma.payment.create({
      data: {
        customerId,
        invoiceId: invoiceId || undefined,
        amount: Number(amount),
        paymentDate: new Date(),
        mode,
        transactionRef: transactionRef || null,
        milestone,
        recordedBy,
        notes: notes || null,
      },
    });

    // Update invoice paid/due amounts
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice) {
        const newPaid = invoice.paidAmount + Number(amount);
        const newDue = Math.max(0, invoice.dueAmount - Number(amount));
        const newStatus = newDue <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : invoice.status;
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { paidAmount: newPaid, dueAmount: newDue, status: newStatus as any },
        });
      }
    }

    // Timeline event
    await prisma.timelineEvent.create({
      data: {
        customerId,
        eventType: 'PAYMENT_RECEIVED',
        description: `Payment of ₹${Number(amount).toLocaleString('en-IN')} received via ${mode} (${milestone})${transactionRef ? ` Ref: ${transactionRef}` : ''}`,
        performedBy: recordedBy,
      },
    });

    // Notify accountant + project head
    const recipients = await prisma.user.findMany({
      where: { role: { in: ['ACCOUNTANT', 'PROJECT_HEAD', 'ADMIN'] as any[] }, isActive: true },
      select: { id: true },
    });
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((u: any) => ({
          userId: u.id,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: `₹${Number(amount).toLocaleString('en-IN')} received for customer — Milestone: ${milestone}`,
          entityType: 'Payment',
          entityId: payment.id,
        })),
      });
    }

    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

// ─── Edit a payment (admin / accountant only) ─────────────────────────────────

export const updatePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { amount, mode, transactionRef, notes, milestone } = req.body;

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Payment not found' } });

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        amount: amount !== undefined ? Number(amount) : existing.amount,
        mode: mode || existing.mode,
        transactionRef: transactionRef !== undefined ? transactionRef : existing.transactionRef,
        notes: notes !== undefined ? notes : existing.notes,
        milestone: milestone || existing.milestone,
      },
    });

    // Recalculate invoice if amount changed and invoice attached
    if (amount !== undefined && existing.invoiceId) {
      const diff = Number(amount) - existing.amount;
      const invoice = await prisma.invoice.findUnique({ where: { id: existing.invoiceId } });
      if (invoice) {
        const newPaid = Math.max(0, invoice.paidAmount + diff);
        const newDue = Math.max(0, invoice.totalAmount - newPaid);
        await prisma.invoice.update({
          where: { id: existing.invoiceId },
          data: { paidAmount: newPaid, dueAmount: newDue, status: newDue <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'SENT' as any },
        });
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};
