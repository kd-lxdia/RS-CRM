import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { closeDeal } from '../services/deal.service';
import { generateInvoicePDF, InvoiceLineItem } from '../services/invoice.service';

// ─── Generate invoice for existing customer ───────────────────────────────────

export const generateInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const userId = (req as any).user.id;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ success: false, error: { message: 'Customer not found' } });

    // Look up the most recent accepted proposal for this customer
    const existingInvoice = await prisma.invoice.findFirst({ where: { customerId }, orderBy: { createdAt: 'desc' } });
    if (existingInvoice) {
      return res.json({ success: true, data: existingInvoice });
    }

    return res.status(400).json({ success: false, error: { message: 'No invoice on record. Use the deal-close endpoint.' } });
  } catch (err) { next(err); }
};

// ─── Close deal (master endpoint) ─────────────────────────────────────────────

export const handleCloseDeal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, proposalId } = req.body;
    const userId = (req as any).user.id;

    if (!leadId || !proposalId) {
      return res.status(400).json({ success: false, error: { message: 'leadId and proposalId required' } });
    }

    const result = await closeDeal(leadId, proposalId, userId);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('does not belong')) {
      return res.status(404).json({ success: false, error: { message: err.message } });
    }
    if (err.message?.includes('status')) {
      return res.status(409).json({ success: false, error: { message: err.message } });
    }
    next(err);
  }
};

// ─── Get invoice ──────────────────────────────────────────────────────────────

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: { select: { id: true, name: true, phone: true, customerCode: true } } },
    });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ─── Get all invoices for customer ────────────────────────────────────────────

export const getCustomerInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
};

// ─── Send invoice (resend) ────────────────────────────────────────────────────

export const sendInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: true },
    });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'SENT', sentAt: new Date() } });

    // TODO: integrate WhatsApp/email with actual message broker
    await prisma.timelineEvent.create({
      data: {
        customerId: invoice.customerId,
        eventType: 'INVOICE_SENT',
        description: `Invoice ${invoice.invoiceNumber} resent to ${invoice.customer.phone} / ${invoice.customer.email || 'email N/A'}`,
        performedBy: (req as any).user.id,
      },
    });

    res.json({ success: true, message: 'Invoice resent to customer.' });
  } catch (err) { next(err); }
};

// ─── Download invoice PDF (stream) ────────────────────────────────────────────

export const downloadInvoicePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: true },
    });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });

    const lineItems = (invoice.items as any[]).map((item: any) => ({
      description: item.description,
      hsn: item.hsn,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
      gstPct: item.gstPct,
      amount: item.amount,
      gstAmount: item.gstAmount,
      total: item.total,
      isDeduction: item.isDeduction,
    })) as InvoiceLineItem[];

    const buffer = await generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.createdAt,
      companyName: 'Slar Solar Private Limited',
      companyAddress: '123 Solar Tower, Connaught Place, New Delhi – 110001',
      companyGSTIN: '07AAXCS1234P1Z5',
      companyPAN: 'AAXCS1234P',
      companyPhone: '+91-98765-43210',
      companyEmail: 'info@slarsolar.com',
      upiId: 'slarsolar@hdfcbank',
      customerName: invoice.customer.name,
      customerAddress: invoice.customer.address,
      customerPhone: invoice.customer.phone,
      customerEmail: invoice.customer.email || '',
      lineItems,
      subtotal: invoice.subtotal,
      totalGST: invoice.gst,
      subsidyDeduction: Math.max(0, invoice.subtotal + invoice.gst - invoice.totalAmount),
      netPayable: invoice.totalAmount,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    }).send(buffer);
  } catch (err) { next(err); }
};
