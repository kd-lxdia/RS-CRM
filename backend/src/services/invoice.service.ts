/**
 * Invoice PDF Generator (pdfkit)
 * Produces a GST-compliant tax invoice with HSN codes and UPI QR code.
 *
 * HSN Codes used:
 *   Solar panels: 85414011
 *   Inverter:      85044090
 *   Structure:     7308
 *   Cables:        85444290
 *   Installation:  998521 (SAC — electrical installation services)
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';

export interface InvoiceLineItem {
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  gstPct: number;
  amount: number;
  gstAmount: number;
  total: number;
  isDeduction?: boolean;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  // Company
  companyName: string;
  companyAddress: string;
  companyGSTIN: string;
  companyPAN: string;
  companyPhone: string;
  companyEmail: string;
  // Customer
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  customerGSTIN?: string;
  // Line items
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalGST: number;
  subsidyDeduction: number;
  netPayable: number;
  // Payment
  upiId: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
}

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function numToWords(n: number): string {
  // Simple Indian number to words for invoice
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + convert(num % 10000000) : '');
  };
  const intPart = Math.floor(n);
  return convert(intPart) + ' Rupees Only';
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, info: { Title: `Invoice ${data.invoiceNumber}`, Author: data.companyName } });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width - 72; // usable width
    const PX = 36;                 // page left margin

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('⚡ SLAR SOLAR', 36, 18);
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
       .text(data.companyAddress, 36, 45)
       .text(`GSTIN: ${data.companyGSTIN}  |  PAN: ${data.companyPAN}  |  ${data.companyPhone}`, 36, 57);

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
       .text('TAX INVOICE', PX, 20, { align: 'right' });

    // ── INVOICE META ─────────────────────────────────────────────────────────
    doc.y = 96;
    doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
    const metaCol1 = PX, metaCol2 = PX + W / 2 + 8;

    // Customer box
    doc.rect(PX, 96, W / 2 - 4, 90).strokeColor('#e2e8f0').stroke();
    doc.rect(PX, 96, W / 2 - 4, 16).fill('#f8fafc').stroke();
    doc.fillColor('#64748b').fontSize(7).text('BILL TO', PX + 6, 100);
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(data.customerName, PX + 6, 116);
    doc.fontSize(8).font('Helvetica').fillColor('#475569')
       .text(data.customerAddress, PX + 6, 130, { width: W / 2 - 20 })
       .text(`Phone: ${data.customerPhone}`, PX + 6, 160)
       .text(`GSTIN: ${data.customerGSTIN || 'UNREGISTERED'}`, PX + 6, 170);

    // Invoice details box
    doc.rect(metaCol2, 96, W / 2 - 4, 90).strokeColor('#e2e8f0').stroke();
    doc.rect(metaCol2, 96, W / 2 - 4, 16).fill('#0f172a').stroke();
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold').text('INVOICE DETAILS', metaCol2 + 6, 100);
    const details = [
      ['Invoice No.', data.invoiceNumber],
      ['Date', data.invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Place of Supply', 'Delhi — 07'],
      ['GST Type', 'IGST (Same State)'],
    ];
    let dy = 118;
    for (const [label, value] of details) {
      doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(label, metaCol2 + 6, dy);
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(value, metaCol2 + 80, dy);
      dy += 14;
    }

    // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
    doc.y = 200;
    const cols: [number, number, string, 'left' | 'right'][] = [
      [PX, 180, 'Description', 'left'],
      [PX + 180, 50, 'HSN/SAC', 'left'],
      [PX + 230, 30, 'Qty', 'right'],
      [PX + 260, 60, 'Unit Rate', 'right'],
      [PX + 320, 40, 'GST%', 'right'],
      [PX + 360, 60, 'GST Amt', 'right'],
      [PX + 420, 66, 'Total', 'right'],
    ];

    // Table header
    doc.rect(PX, 205, W, 18).fill('#0f172a');
    for (const [x, w, label, align] of cols) {
      doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
         .text(label, x + 2, 210, { width: w - 4, align });
    }

    let ty = 223;
    for (let i = 0; i < data.lineItems.length; i++) {
      const item = data.lineItems[i];
      const bg = item.isDeduction ? '#fef2f2' : (i % 2 === 0 ? '#ffffff' : '#f8fafc');
      doc.rect(PX, ty, W, 20).fill(bg);
      doc.rect(PX, ty, W, 20).stroke('#e2e8f0');

      const color = item.isDeduction ? '#dc2626' : '#0f172a';
      doc.fillColor(color).fontSize(7.5).font('Helvetica');
      doc.text(item.description, cols[0][0] + 3, ty + 6, { width: cols[0][1] - 6 });
      doc.text(item.hsn, cols[1][0] + 2, ty + 6, { width: cols[1][1] - 4 });
      doc.text(item.isDeduction ? '' : `${item.qty}`, cols[2][0] + 2, ty + 6, { width: cols[2][1] - 4, align: 'right' });
      doc.text(item.isDeduction ? '' : rupees(item.rate), cols[3][0] + 2, ty + 6, { width: cols[3][1] - 4, align: 'right' });
      doc.text(item.isDeduction ? '' : `${item.gstPct}%`, cols[4][0] + 2, ty + 6, { width: cols[4][1] - 4, align: 'right' });
      doc.text(item.isDeduction ? '' : rupees(item.gstAmount), cols[5][0] + 2, ty + 6, { width: cols[5][1] - 4, align: 'right' });
      doc.fillColor(item.isDeduction ? '#dc2626' : '#1d4ed8').font('Helvetica-Bold')
         .text(rupees(item.total), cols[6][0] + 2, ty + 6, { width: cols[6][1] - 4, align: 'right' });

      ty += 20;
    }

    // Totals block
    const totals: [string, number, boolean][] = [
      ['Subtotal (excl. GST)', data.subtotal, false],
      ['Total GST', data.totalGST, false],
      ['Subsidy Deduction', -data.subsidyDeduction, data.subsidyDeduction > 0],
      ['Net Payable', data.netPayable, false],
    ];
    let totY = ty + 6;
    for (const [label, amount, isSub] of totals) {
      const isNet = label === 'Net Payable';
      if (isNet) doc.rect(PX + W - 180, totY - 2, 180, 22).fill('#0f172a');
      doc.fillColor(isNet ? '#ffffff' : (isSub ? '#16a34a' : '#0f172a'))
         .fontSize(isNet ? 10 : 8)
         .font(isNet ? 'Helvetica-Bold' : 'Helvetica')
         .text(label, PX + W - 180 + 4, totY + 1, { width: 100 });
      doc.font('Helvetica-Bold')
         .text((isSub ? `(${rupees(Math.abs(amount))})` : rupees(Math.abs(amount))), PX + W - 76, totY + 1, { width: 72, align: 'right' });
      totY += isNet ? 22 : 16;
    }

    // Amount in words
    const wordsY = totY + 10;
    doc.rect(PX, wordsY, W, 24).fill('#eff6ff').stroke('#dbeafe');
    doc.fillColor('#1e3a8a').fontSize(8).font('Helvetica-Bold')
       .text('Amount in Words: ', PX + 6, wordsY + 8);
    doc.font('Helvetica').fillColor('#1e40af')
       .text(numToWords(data.netPayable), PX + 100, wordsY + 8, { width: W - 110 });

    // ── QR CODE + PAYMENT INFO ────────────────────────────────────────────────
    const qrY = wordsY + 34;
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Payment Information', PX, qrY);
    doc.moveTo(PX, qrY + 12).lineTo(PX + W, qrY + 12).stroke('#e2e8f0');

    // Generate QR code for UPI
    const upiString = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(data.companyName)}&am=${data.netPayable}&cu=INR&tn=${encodeURIComponent(`Invoice ${data.invoiceNumber}`)}`;
    try {
      const qrBuffer = await QRCode.toBuffer(upiString, { type: 'png', width: 80, margin: 1 });
      doc.image(qrBuffer, PX, qrY + 18, { width: 80, height: 80 });
    } catch { /* QR generation failed, skip */ }

    doc.fontSize(8).font('Helvetica').fillColor('#475569')
       .text('Scan to Pay via UPI', PX, qrY + 100, { width: 80, align: 'center' });

    const payX = PX + 96;
    const payDetails: [string, string][] = [
      ['UPI ID', data.upiId],
      ['Bank', data.bankName || 'HDFC Bank'],
      ['Account No.', data.accountNo || '—'],
      ['IFSC', data.ifsc || '—'],
    ];
    let pdy = qrY + 22;
    for (const [label, value] of payDetails) {
      doc.fillColor('#64748b').fontSize(7.5).text(label + ':', payX, pdy);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(value, payX + 80, pdy);
      pdy += 14;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footY = doc.page.height - 60;
    doc.moveTo(PX, footY).lineTo(PX + W, footY).strokeColor('#e2e8f0').stroke();
    doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
       .text('This is a computer-generated invoice. No physical signature required. Goods once sold are not returnable.', PX, footY + 6, { width: W, align: 'center' })
       .text(`${data.companyName}  |  ${data.companyEmail}  |  ${data.companyPhone}`, PX, footY + 18, { width: W, align: 'center' });

    doc.end();
  });
}
