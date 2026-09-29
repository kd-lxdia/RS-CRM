/**
 * Deal Closing Service
 * Orchestrates: customer creation, invoice generation, agreement PDF,
 * doc officer assignment, notifications, S3 upload, timeline events.
 */

import { prisma } from '../lib/clients';
import { generateInvoicePDF, InvoiceLineItem } from './invoice.service';
import { generateAgreementPDF } from './agreement.service';
import { uploadBufferToS3 } from '../utils/s3';

// ─── Constants ─────────────────────────────────────────────────────────────────

const COMPANY = {
  name: 'Slar Solar Private Limited',
  address: '123 Solar Tower, Connaught Place, New Delhi – 110001',
  gstin: '07AAXCS1234P1Z5',
  pan: 'AAXCS1234P',
  phone: '+91-98765-43210',
  email: 'info@slarsolar.com',
  upiId: 'slarsolar@hdfcbank',
  bankName: 'HDFC Bank',
  accountNo: '50200012345678',
  ifsc: 'HDFC0001234',
};

const MILESTONE_DEFAULTS = [
  { label: 'Booking Advance', pct: 10 },
  { label: 'Material Procurement', pct: 40 },
  { label: 'Installation Commencement', pct: 30 },
  { label: 'Commissioning & Handover', pct: 20 },
];

// HSN codes per item type
const HSN = {
  panel: '85414011',
  inverter: '85044090',
  structure: '7308',
  cable: '85444290',
  install: '998521',
};

// ─── Sequence generators ───────────────────────────────────────────────────────

async function nextCustomerCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.customer.count({ where: { customerCode: { startsWith: `CUST-${year}` } } });
  return `CUST-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}` } } });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

// ─── Build line items from proposal ─────────────────────────────────────────────

function buildLineItems(proposal: any): InvoiceLineItem[] {
  const panelCostPerUnit = Math.round(proposal.panelWattage * 28); // ₹28/W default
  const panelBase = panelCostPerUnit * proposal.panelCount;
  const panelGst = Math.round(panelBase * 0.12);

  const inverterBase = Math.round(proposal.inverterCapacity * 9000);
  const inverterGst = Math.round(inverterBase * 0.18);

  const structureBase = Math.round(proposal.systemSizeKw * 7000);
  const structureGst = Math.round(structureBase * 0.12);

  const cablesBase = Math.round(proposal.systemSizeKw * 3500);
  const cablesGst = Math.round(cablesBase * 0.18);

  const installBase = Math.round(proposal.systemSizeKw * 4000);
  const installGst = Math.round(installBase * 0.18);

  const items: InvoiceLineItem[] = [
    {
      description: `${proposal.panelBrand} ${proposal.panelModel} ${proposal.panelWattage}Wp Solar Panel`,
      hsn: HSN.panel,
      qty: proposal.panelCount,
      unit: 'Nos',
      rate: panelCostPerUnit,
      gstPct: 12,
      amount: panelBase,
      gstAmount: panelGst,
      total: panelBase + panelGst,
    },
    {
      description: `${proposal.inverterBrand} ${proposal.inverterModel} ${proposal.inverterCapacity}kW On-Grid Inverter`,
      hsn: HSN.inverter,
      qty: 1,
      unit: 'Nos',
      rate: inverterBase,
      gstPct: 18,
      amount: inverterBase,
      gstAmount: inverterGst,
      total: inverterBase + inverterGst,
    },
    {
      description: 'MS/GI Mounting Structure with Hardware',
      hsn: HSN.structure,
      qty: proposal.systemSizeKw,
      unit: 'kW',
      rate: 7000,
      gstPct: 12,
      amount: structureBase,
      gstAmount: structureGst,
      total: structureBase + structureGst,
    },
    {
      description: 'DC/AC Cables, MC4 Connectors, Cable Trays',
      hsn: HSN.cable,
      qty: proposal.systemSizeKw,
      unit: 'kW',
      rate: 3500,
      gstPct: 18,
      amount: cablesBase,
      gstAmount: cablesGst,
      total: cablesBase + cablesGst,
    },
    {
      description: 'Installation, Commissioning & Net Meter Application',
      hsn: HSN.install,
      qty: 1,
      unit: 'Job',
      rate: installBase,
      gstPct: 18,
      amount: installBase,
      gstAmount: installGst,
      total: installBase + installGst,
    },
  ];

  if (proposal.subsidyAmount && proposal.subsidyAmount > 0) {
    const sub = Math.round(proposal.subsidyAmount);
    items.push({
      description: `Govt. Subsidy Deduction (${proposal.subsidyScheme || 'PM Surya Ghar Yojana'})`,
      hsn: '—',
      qty: 1,
      unit: 'Lump',
      rate: -sub,
      gstPct: 0,
      amount: -sub,
      gstAmount: 0,
      total: -sub,
      isDeduction: true,
    });
  }

  return items;
}

// ─── Round-robin doc officer assignment ──────────────────────────────────────────

async function assignDocOfficer(): Promise<string | null> {
  try {
    const docUsers = await prisma.user.findMany({
      where: { role: 'DOCUMENTATION' as any, isActive: true },
      include: { _count: { select: { docCustomers: true } } },
      orderBy: { id: 'asc' },
    });
    if (!docUsers.length) return null;
    // Pick the one with fewest active customers
    docUsers.sort((a: any, b: any) => a._count.docCustomers - b._count.docCustomers);
    return docUsers[0].id;
  } catch {
    return null;
  }
}

// ─── S3 upload helper ─────────────────────────────────────────────────────────

async function uploadToS3(buffer: Buffer, key: string, contentType = 'application/pdf'): Promise<string> {
  try {
    return await uploadBufferToS3(buffer, key, contentType);
  } catch {
    return `local://${key}`;
  }
}

// ─── Main closeDeal function ──────────────────────────────────────────────────

export async function closeDeal(leadId: string, proposalId: string, userId: string): Promise<any> {
  // 1. Validate
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) throw new Error('Lead not found');

  const proposal = await prisma.solarProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.leadId !== leadId) throw new Error('Proposal does not belong to this lead');

  // Allow closing from SENT or DRAFT (in case salesperson skips formal send step)
  const allowedStatuses = ['DRAFT', 'SENT', 'ACCEPTED'];
  if (!allowedStatuses.includes(proposal.status)) {
    throw new Error(`Proposal status ${proposal.status} cannot be used to close a deal`);
  }

  const now = new Date();

  // 2. Generate codes
  const customerCode = await nextCustomerCode();
  const invoiceNumber = await nextInvoiceNumber();

  // 3. Build invoice line items
  const lineItems = buildLineItems(proposal);
  const subtotal = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.amount, 0);
  const totalGST = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.gstAmount, 0);
  const subsidyDeduction = Math.abs(lineItems.find(i => i.isDeduction)?.total || 0);
  const netPayable = Math.round(subtotal + totalGST - subsidyDeduction);

  // 4. Create customer record
  const customer = await prisma.customer.create({
    data: {
      customerCode,
      leadId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || undefined,
      address: lead.address || '',
      city: lead.city || '',
      pincode: lead.pincode || '',
      lat: lead.lat,
      lng: lead.lng,
      zoneId: lead.zoneId,
      assignedSalesperson: lead.assignedSalesperson,
      dealerId: lead.dealerId || undefined,
      status: 'ACTIVE',
    },
  });

  // 5. Update lead → customer link
  await prisma.lead.update({ where: { id: leadId }, data: { status: 'WON' as any, customerId: customer.id } });

  // 6. accept proposal (supersede others)
  await prisma.solarProposal.updateMany({
    where: { leadId, id: { not: proposalId } },
    data: { status: 'REJECTED' as any },
  });
  await prisma.solarProposal.update({
    where: { id: proposalId },
    data: { status: 'ACCEPTED' as any, customerId: customer.id },
  });

  // 7. Create Invoice DB record
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: customer.id,
      items: lineItems as any,
      subtotal,
      gst: totalGST,
      totalAmount: subtotal + totalGST,
      paidAmount: 0,
      dueAmount: netPayable,
      status: 'DRAFT',
      generatedBy: userId,
    },
  });

  // 8. Generate PDFs
  const invoicePdfBuffer = await generateInvoicePDF({
    invoiceNumber,
    invoiceDate: now,
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    companyGSTIN: COMPANY.gstin,
    companyPAN: COMPANY.pan,
    companyPhone: COMPANY.phone,
    companyEmail: COMPANY.email,
    upiId: COMPANY.upiId,
    bankName: COMPANY.bankName,
    accountNo: COMPANY.accountNo,
    ifsc: COMPANY.ifsc,
    customerName: customer.name,
    customerAddress: customer.address,
    customerPhone: customer.phone,
    customerEmail: customer.email || '',
    lineItems,
    subtotal,
    totalGST,
    subsidyDeduction,
    netPayable,
  });

  const agreementPdfBuffer = await generateAgreementPDF({
    agreementNumber: `AGR-${now.getFullYear()}-${customerCode.split('-').pop()}`,
    date: now,
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    companyGSTIN: COMPANY.gstin,
    companyRep: 'Authorised Signatory',
    customerName: customer.name,
    customerAddress: customer.address,
    customerPhone: customer.phone,
    customerEmail: customer.email || '',
    systemKw: proposal.systemSizeKw,
    panelBrand: proposal.panelBrand,
    panelModel: proposal.panelModel,
    panelWattage: proposal.panelWattage,
    panelCount: proposal.panelCount,
    inverterBrand: proposal.inverterBrand,
    inverterModel: proposal.inverterModel,
    inverterKw: proposal.inverterCapacity,
    roofType: proposal.roofType,
    structureType: proposal.structureType,
    estimatedInstallDays: 15,
    totalCost: proposal.totalCost,
    subsidyAmount: proposal.subsidyAmount || 0,
    netCost: netPayable,
    milestones: MILESTONE_DEFAULTS.map(m => ({
      ...m,
      amount: Math.round(netPayable * m.pct / 100),
    })),
  });

  // 9. Upload to S3
  const invoicePdfUrl = await uploadToS3(invoicePdfBuffer, `invoices/${invoiceNumber}.pdf`);
  const agreementPdfUrl = await uploadToS3(agreementPdfBuffer, `agreements/AGR-${customerCode}.pdf`);

  // 10. Store Document records
  await prisma.document.createMany({
    data: [
      { customerId: customer.id, type: 'INVOICE' as any, url: invoicePdfUrl, uploadedBy: userId },
      { customerId: customer.id, type: 'AGREEMENT' as any, url: agreementPdfUrl, uploadedBy: userId },
    ],
  });

  // 11. Assign doc officer
  const docOfficerId = await assignDocOfficer();
  if (docOfficerId) {
    await prisma.customer.update({ where: { id: customer.id }, data: { assignedDocumentation: docOfficerId } });
    await prisma.documentationChecklist.create({
      data: {
        customerId: customer.id,
        assignedTo: docOfficerId,
        pmSuryaStatus: 'PENDING',
        cmSchemeApplicable: (proposal.subsidyScheme || '').includes('Delhi'),
        loanApplicable: proposal.loanApplicable,
        loanStatus: proposal.loanApplicable ? 'PENDING' : 'NA',
      },
    });

    await prisma.notification.create({
      data: {
        userId: docOfficerId,
        type: 'DEAL_CLOSED',
        title: 'New Customer Assigned',
        message: `${customer.name} (${customerCode}) has been assigned to you for documentation.`,
        entityType: 'Customer',
        entityId: customer.id,
      },
    });
  }

  // 12. Timeline events
  await prisma.timelineEvent.createMany({
    data: [
      { leadId, customerId: customer.id, eventType: 'DEAL_CLOSED', description: `Deal closed! Customer ${customerCode} created (₹${netPayable.toLocaleString('en-IN')})`, performedBy: userId },
      { leadId, customerId: customer.id, eventType: 'INVOICE_GENERATED', description: `Invoice ${invoiceNumber} generated (₹${netPayable.toLocaleString('en-IN')})`, performedBy: userId },
      { leadId, customerId: customer.id, eventType: 'AGREEMENT_GENERATED', description: 'Solar installation agreement generated and ready to send', performedBy: userId },
    ],
  });

  // 13. Notify admin + project head
  const leaders = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'PROJECT_HEAD'] as any[] }, isActive: true }, select: { id: true } });
  if (leaders.length) {
    await prisma.notification.createMany({
      data: leaders.map((u: any) => ({
        userId: u.id,
        type: 'DEAL_CLOSED',
        title: '🎉 Deal Closed!',
        message: `${lead.name} converted to customer ${customerCode}. System: ${proposal.systemSizeKw}kW, Value: ₹${netPayable.toLocaleString('en-IN')}`,
        entityType: 'Customer',
        entityId: customer.id,
      })),
    });
  }

  return {
    customer,
    invoice,
    invoicePdfUrl,
    agreementPdfUrl,
    netPayable,
    lineItems,
  };
}
