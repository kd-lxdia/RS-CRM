/**
 * Agreement PDF Generator (pdfkit)
 * Produces a solar installation agreement with specs, payment schedule,
 * warranty table, cancellation policy, and signature block.
 */

import PDFDocument from 'pdfkit';

export interface AgreementData {
  agreementNumber: string;
  date: Date;
  // Parties
  companyName: string;
  companyAddress: string;
  companyGSTIN: string;
  companyRep: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  customerAadhaar?: string;
  // System
  systemKw: number;
  panelBrand: string;
  panelModel: string;
  panelWattage: number;
  panelCount: number;
  inverterBrand: string;
  inverterModel: string;
  inverterKw: number;
  roofType: string;
  structureType: string;
  estimatedInstallDays: number;
  // Financials
  totalCost: number;
  subsidyAmount: number;
  netCost: number;
  // Milestones
  milestones: { label: string; pct: number; amount: number }[];
}

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export async function generateAgreementPDF(data: AgreementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Solar Agreement ${data.agreementNumber}` } });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width - 84;
    const PX = 42;

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 72).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('⚡ SLAR SOLAR', PX, 16);
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text('Solar Installation Agreement', PX, 40);
    doc.fontSize(9).fillColor('#60a5fa').font('Helvetica-Bold')
       .text(`Agreement No: ${data.agreementNumber}`, PX, 52);
    doc.fontSize(8).font('Helvetica').fillColor('#cbd5e1')
       .text(`Date: ${data.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 0, 52, { width: doc.page.width - 42, align: 'right' });

    doc.y = 86;

    // ── PARTIES ──────────────────────────────────────────────────────────────
    const section = (title: string) => {
      doc.rect(PX, doc.y, W, 18).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(title, PX + 6, doc.y + 4);
      doc.y += 22;
    };

    const row2 = (label: string, val: string, label2?: string, val2?: string) => {
      const y = doc.y;
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(label, PX + 4, y);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(val, PX + 90, y, { width: W / 2 - 94 });
      if (label2 && val2) {
        doc.fillColor('#64748b').font('Helvetica').text(label2, PX + W / 2 + 4, y);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(val2, PX + W / 2 + 90, y, { width: W / 2 - 94 });
      }
      doc.y = y + 14;
    };

    section('PARTIES TO THIS AGREEMENT');
    doc.rect(PX, doc.y, W / 2 - 2, 70).strokeColor('#e2e8f0').stroke();
    doc.rect(PX + W / 2 + 2, doc.y, W / 2 - 2, 70).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#1d4ed8').fontSize(8).font('Helvetica-Bold').text('Service Provider', PX + 6, doc.y + 4);
    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica')
       .text(`${data.companyName}\nGSTIN: ${data.companyGSTIN}\n${data.companyAddress}\nRep: ${data.companyRep}`, PX + 6, doc.y + 16, { width: W / 2 - 14 });
    const custX = PX + W / 2 + 8;
    const prevY = doc.y;
    doc.fillColor('#1d4ed8').fontSize(8).font('Helvetica-Bold').text('Customer (User / Owner)', custX, prevY + 4);
    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica')
       .text(`${data.customerName}\n${data.customerPhone} | ${data.customerEmail}\n${data.customerAddress}`, custX, prevY + 16, { width: W / 2 - 14 });
    doc.y = prevY + 76;

    // ── SYSTEM SPECS ─────────────────────────────────────────────────────────
    doc.y += 6;
    section('SYSTEM SPECIFICATIONS');
    const specs: [string, string, string, string][] = [
      ['System Capacity', `${data.systemKw} kWp`, 'Installation Type', data.roofType],
      ['Solar Panels', `${data.panelBrand} ${data.panelModel} ${data.panelWattage}W`, 'Panel Count', `${data.panelCount} panels`],
      ['Inverter', `${data.inverterBrand} ${data.inverterModel} ${data.inverterKw}kW`, 'Structure Type', data.structureType],
      ['Est. Completion', `${data.estimatedInstallDays} working days`, 'Performance Ratio', '≥ 80%'],
    ];
    for (const [l1, v1, l2, v2] of specs) row2(l1, v1, l2, v2);

    // ── FINANCIALS ────────────────────────────────────────────────────────────
    doc.y += 6;
    section('FINANCIAL TERMS');
    const fin: [string, string][] = [
      ['Total System Cost', rupees(data.totalCost)],
      ['Government Subsidy (PM Surya Ghar + Delhi CM)', `(${rupees(data.subsidyAmount)})`],
      ['Net Amount Payable by Customer', rupees(data.netCost)],
    ];
    for (const [l, v] of fin) {
      const isNet = l.includes('Net Amount');
      if (isNet) doc.rect(PX, doc.y, W, 16).fill('#eff6ff');
      doc.fillColor(isNet ? '#1e3a8a' : '#0f172a').fontSize(isNet ? 9 : 8)
         .font(isNet ? 'Helvetica-Bold' : 'Helvetica')
         .text(l, PX + 4, doc.y + 3, { width: W - 100 });
      doc.font('Helvetica-Bold').fillColor(l.includes('Subsidy') ? '#16a34a' : isNet ? '#1d4ed8' : '#0f172a')
         .text(v, PX + W - 96, doc.y + 3, { width: 92, align: 'right' });
      doc.y += 16;
    }

    // ── PAYMENT MILESTONES ────────────────────────────────────────────────────
    doc.y += 6;
    section('PAYMENT SCHEDULE');
    // Table header
    doc.rect(PX, doc.y, W, 16).fill('#f1f5f9');
    ['#', 'Milestone', '%', 'Amount', 'Due Date', 'Status'].forEach((h, i) => {
      const xs = [PX + 2, PX + 22, PX + W - 260, PX + W - 200, PX + W - 120, PX + W - 60];
      doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text(h, xs[i], doc.y + 4);
    });
    doc.y += 16;
    for (let i = 0; i < data.milestones.length; i++) {
      const m = data.milestones[i];
      if (i % 2 === 0) doc.rect(PX, doc.y, W, 18).fill('#f8fafc');
      doc.rect(PX, doc.y, W, 18).stroke('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`${i + 1}`, PX + 4, doc.y + 5);
      doc.text(m.label, PX + 22, doc.y + 5);
      doc.text(`${m.pct}%`, PX + W - 256, doc.y + 5);
      doc.font('Helvetica-Bold').fillColor('#1d4ed8').text(rupees(m.amount), PX + W - 200, doc.y + 5);
      doc.fillColor('#94a3b8').font('Helvetica').text('___________', PX + W - 120, doc.y + 5);
      doc.fillColor('#d1fae5').font('Helvetica-Bold').fontSize(6)
         .text('PENDING', PX + W - 60, doc.y + 6);
      doc.y += 18;
    }

    // ── WARRANTY ─────────────────────────────────────────────────────────────
    doc.addPage();
    section('WARRANTY TERMS');
    const warranties: [string, string, string][] = [
      ['Solar Panels', '25 years performance (80% output at Yr 25) + 10 years product warranty', data.panelBrand],
      ['Inverter', '5 years standard (extendable to 10 years)', data.inverterBrand],
      ['Mounting Structure', '10 years structural warranty', 'GI/Aluminium'],
      ['Installation Workmanship', '1 year from commissioning date', data.companyName],
      ['Monitoring System', '1 year hardware warranty', data.companyName],
    ];
    doc.rect(PX, doc.y, W, 16).fill('#0f172a');
    ['Component', 'Warranty', 'By'].forEach((h, i) => {
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold').text(h, [PX + 2, PX + 130, PX + W - 130][i], doc.y + 4);
    });
    doc.y += 16;
    for (const [comp, warr, by] of warranties) {
      doc.rect(PX, doc.y, W, 18).stroke('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
      doc.text(comp, PX + 2, doc.y + 5);
      doc.text(warr, PX + 130, doc.y + 5, { width: W - 260 });
      doc.fillColor('#1d4ed8').font('Helvetica-Bold').text(by, PX + W - 128, doc.y + 5);
      doc.y += 18;
    }

    // ── CANCELLATION POLICY ───────────────────────────────────────────────────
    doc.y += 10;
    section('CANCELLATION & REFUND POLICY');
    const policies = [
      'Within 48 hours of booking — 100% refund of booking amount.',
      'After material procurement has commenced — booking amount forfeited; materials cost deducted from refund.',
      'After installation has commenced — no refund applicable; customer must pay for work completed.',
      'Post-commissioning — the system belongs to the customer; no returns accepted.',
    ];
    for (const [idx, p] of policies.entries()) {
      doc.rect(PX, doc.y, W, 20).fill(idx % 2 === 0 ? '#ffffff' : '#f8fafc');
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
         .text(`${idx + 1}. ${p}`, PX + 6, doc.y + 5, { width: W - 12 });
      doc.y += 20;
    }

    // ── SIGNATURE BLOCK ───────────────────────────────────────────────────────
    doc.y += 20;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
       .text('By signing below, both parties agree to the terms and conditions set forth in this agreement.', PX, doc.y, { width: W, align: 'center' });
    doc.y += 20;

    const sigColW = W / 2 - 10;
    // Customer sig
    doc.rect(PX, doc.y, sigColW, 60).stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(7).text('Customer Signature', PX + 6, doc.y + 6);
    doc.moveTo(PX + 6, doc.y + 40).lineTo(PX + sigColW - 6, doc.y + 40).stroke('#cbd5e1');
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(data.customerName, PX + 6, doc.y + 44);
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Name & Date', PX + 6, doc.y + 54);

    // Company sig
    const sigX2 = PX + sigColW + 20;
    doc.rect(sigX2, doc.y - 60 + doc.y - doc.y + 60, sigColW, 60).stroke('#e2e8f0');
    doc.rect(sigX2, doc.y, sigColW, 60).stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(7).text('Authorised Signatory', sigX2 + 6, doc.y + 6);
    doc.fillColor('#1d4ed8').fontSize(8).font('Helvetica-Bold').text(data.companyName, sigX2 + 6, doc.y + 44);
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(data.companyRep, sigX2 + 6, doc.y + 54);

    doc.end();
  });
}
