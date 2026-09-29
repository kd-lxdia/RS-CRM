// Ported from Proposal-RS pdfGenerator.js. Overlays form data onto the 12
// RS-branded template pages served from /proposal-templates/.
import { jsPDF } from 'jspdf';
import { formFields, BomRow } from './fields';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function generateProposalPdf(
  formData: Record<string, any>,
  bomData: BomRow[],
): Promise<void> {
  let doc: jsPDF | null = null;

  for (let pageNum = 1; pageNum <= 12; pageNum++) {
    let img: HTMLImageElement;
    try {
      img = await loadImage(`/proposal-templates/${pageNum}.png`);
    } catch {
      if (!doc) doc = new jsPDF('p', 'pt', 'a4');
      else doc.addPage();
      continue;
    }

    if (!doc) {
      doc = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height],
      });
    } else {
      doc.addPage([img.width, img.height], img.width > img.height ? 'l' : 'p');
    }

    doc.addImage(img, 'PNG', 0, 0, img.width, img.height);

    if (![9, 10, 12].includes(pageNum)) {
      const pageFields = formFields.filter((f) => f.page === pageNum && f.type !== 'bom_table');
      pageFields.forEach((field) => {
        let value = field.autoSync ? formData[field.autoSync] : formData[field.id];
        if (value !== undefined && value !== null && value !== '') {
          if (field.prefix) value = field.prefix + value;
          if (field.suffix) value = value + field.suffix;
          if (field.color) doc!.setTextColor(field.color[0], field.color[1], field.color[2]);
          else doc!.setTextColor(50, 50, 50);
          doc!.setFontSize(img.height * (field.fontSize || 0.012));
          doc!.setFont('helvetica', field.fontStyle || 'normal');
          doc!.text(value.toString(), field.x! * img.width, field.y! * img.height, {
            align: field.align || 'left',
          });
        }
      });
    }

    if (pageNum === 8) {
      const bomField = formFields.find((f) => f.page === 8 && f.type === 'bom_table');
      if (bomField && bomData) {
        if (bomField.color) doc.setTextColor(bomField.color[0], bomField.color[1], bomField.color[2]);
        else doc.setTextColor(100, 110, 120);
        doc.setFontSize(img.height * (bomField.fontSize || 0.01));
        doc.setFont('helvetica', bomField.fontStyle || 'normal');
        let currentY = bomField.startY! * img.height;
        bomField.items!.forEach((_item, index) => {
          const rowData = bomData[index] || ({} as BomRow);
          if (rowData.make) doc!.text(rowData.make.toString(), 0.53 * img.width, currentY, { align: 'center' });
          if (rowData.spec) doc!.text(rowData.spec.toString(), 0.69 * img.width, currentY, { align: 'center' });
          if (rowData.unit) doc!.text(rowData.unit.toString(), 0.84 * img.width, currentY, { align: 'center' });
          if (rowData.qty) doc!.text(rowData.qty.toString(), 0.915 * img.width, currentY, { align: 'center' });
          currentY += bomField.rowHeight! * img.height;
        });
      }
    }
  }

  const clientName = formData.clientName || 'Client';
  const safe = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  doc!.save(`${safe}_Quotation.pdf`);
}

// Derive solar economics from system size + tariff so the proposal auto-fills.
export function computeSolarEconomics(kw: number, tariff: number, costPerKw = 55000) {
  const annualGeneration = Math.round(kw * 1400); // ~1400 kWh/kWp/yr (India avg)
  const annualSaving = Math.round(annualGeneration * tariff);
  const projectCost = Math.round(kw * costPerKw);
  const payback = annualSaving > 0 ? +(projectCost / annualSaving).toFixed(1) : 0;
  const co2 = +(annualGeneration * 0.00082).toFixed(1); // tons CO2/yr
  const trees = Math.round(co2 * 45);
  return { annualGeneration, annualSaving, projectCost, payback, co2, trees };
}
