// Ported from the Proposal-RS quotation generator. Field coordinates are
// fractions of each template image (12 RS-branded template PNGs live in
// /public/proposal-templates). Colors are the Rocker Solar brand palette.

export const orangeColor: [number, number, number] = [239, 144, 27];
export const navyColor: [number, number, number] = [18, 30, 49];
export const greyColor: [number, number, number] = [100, 110, 120];

export interface ProposalField {
  id: string;
  label: string;
  page: number;
  type: string;
  defaultValue?: string;
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right';
  color?: [number, number, number];
  fontSize?: number;
  fontStyle?: 'normal' | 'bold';
  prefix?: string;
  suffix?: string;
  autoSync?: string;
  hidden?: boolean;
  options?: string[];
  // bom_table only
  startY?: number;
  rowHeight?: number;
  items?: string[];
}

export const formFields: ProposalField[] = [
  // Page 1
  { id: 'quotationNo', label: 'Quotation No', page: 1, type: 'text', defaultValue: 'RS-Q-0000', x: 0.12, y: 0.885, align: 'center', color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'date', label: 'Date', page: 1, type: 'date', defaultValue: '', x: 0.31, y: 0.885, align: 'center', color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'clientName', label: 'Client Name', page: 1, type: 'text', defaultValue: '', x: 0.50, y: 0.885, align: 'center', color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'projectLocation', label: 'Project Location', page: 1, type: 'text', defaultValue: '', x: 0.68, y: 0.885, align: 'center', color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'systemCapacityP1', label: 'System Capacity (kWp)', page: 1, type: 'text', defaultValue: '', x: 0.88, y: 0.885, align: 'center', color: navyColor, fontSize: 0.012, fontStyle: 'bold' },

  // Page 2
  { id: 'clientName', label: 'Client Name (Auto-filled)', page: 2, type: 'text', defaultValue: '', x: 0.125, y: 0.3365, color: orangeColor, fontSize: 0.020, fontStyle: 'bold', autoSync: 'clientName', hidden: true },
  { id: 'clientCompany', label: 'Client Company Name', page: 2, type: 'text', defaultValue: '', x: 0.17, y: 0.725, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'contactPerson', label: 'Contact Person', page: 2, type: 'text', defaultValue: '', x: 0.17, y: 0.772, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'phoneNumber', label: 'Phone Number', page: 2, type: 'tel', defaultValue: '', x: 0.17, y: 0.819, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'emailAddress', label: 'Email Address', page: 2, type: 'email', defaultValue: '', x: 0.17, y: 0.863, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'gstin', label: 'GSTIN', page: 2, type: 'text', defaultValue: '', x: 0.17, y: 0.905, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'clientAddress', label: 'Client Address', page: 2, type: 'text', defaultValue: '', x: 0.63, y: 0.725, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'siteAddress', label: 'Site Address', page: 2, type: 'text', defaultValue: '', x: 0.63, y: 0.780, color: navyColor, fontSize: 0.012, fontStyle: 'bold' },
  { id: 'date', label: 'Date (Auto-filled)', page: 2, type: 'date', defaultValue: '', x: 0.63, y: 0.840, color: navyColor, fontSize: 0.012, fontStyle: 'bold', autoSync: 'date', hidden: true },
  { id: 'validityDays', label: 'Validity', page: 2, type: 'number', defaultValue: '30', x: 0.63, y: 0.895, color: navyColor, fontSize: 0.012, fontStyle: 'bold', suffix: ' days' },

  // Page 6 - Project Value (Orange)
  { id: 'plantType', label: 'Plant Type', page: 6, type: 'select', options: ['On-grid', 'C&I', 'Industrial'], defaultValue: 'On-grid', x: 0.16, y: 0.493, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold' },
  { id: 'proposedCapacity', label: 'Proposed Capacity', page: 6, type: 'text', defaultValue: '', x: 0.495, y: 0.493, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold', suffix: ' kW' },
  { id: 'annualGeneration', label: 'Annual Generation', page: 6, type: 'text', defaultValue: '', x: 0.83, y: 0.493, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold', suffix: ' kWh/year' },
  { id: 'moduleType', label: 'Module Type', page: 6, type: 'text', defaultValue: '', x: 0.16, y: 0.634, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold' },
  { id: 'inverterType', label: 'Inverter Type', page: 6, type: 'text', defaultValue: '', x: 0.495, y: 0.634, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold' },
  { id: 'siteCondition', label: 'Site Condition', page: 6, type: 'text', defaultValue: '', x: 0.83, y: 0.634, align: 'center', color: orangeColor, fontSize: 0.025, fontStyle: 'bold' },
  { id: 'paybackPeriodP6', label: 'Payback Period', page: 6, type: 'text', defaultValue: '', x: 0.12, y: 0.803, align: 'center', color: orangeColor, fontSize: 0.016, fontStyle: 'bold', suffix: ' Years' },
  { id: 'treesSaved', label: 'Trees Saved', page: 6, type: 'text', defaultValue: '', x: 0.31, y: 0.803, align: 'center', color: orangeColor, fontSize: 0.016, fontStyle: 'bold', suffix: '/year' },
  { id: 'co2Reduction', label: 'CO2 Reduction', page: 6, type: 'text', defaultValue: '', x: 0.50, y: 0.803, align: 'center', color: orangeColor, fontSize: 0.016, fontStyle: 'bold', suffix: ' Tons/year' },
  { id: 'avgAnnualSavingP6', label: 'Avg Annual Saving', page: 6, type: 'text', defaultValue: '', x: 0.69, y: 0.803, align: 'center', color: orangeColor, fontSize: 0.016, fontStyle: 'bold', prefix: 'Rs. ', suffix: '/year' },
  { id: 'effectiveProjectCost', label: 'Effective Project Cost', page: 6, type: 'text', defaultValue: '', x: 0.88, y: 0.803, align: 'center', color: orangeColor, fontSize: 0.016, fontStyle: 'bold', prefix: 'Rs. ' },

  // Page 7 - Interactive Design
  { id: 'link3d', label: '3D Link', page: 7, type: 'url', defaultValue: '', x: 0.28, y: 0.565, color: orangeColor, fontSize: 0.012, fontStyle: 'normal' },
  { id: 'projectedSavings', label: 'Projected Savings', page: 7, type: 'text', defaultValue: '', x: 0.075, y: 0.745, color: orangeColor, fontSize: 0.022, fontStyle: 'bold', prefix: 'Rs. ' },
  { id: 'avgAnnualSavingP7', label: 'Avg Annual Saving', page: 7, type: 'text', defaultValue: '', x: 0.13, y: 0.80, color: orangeColor, fontSize: 0.012, fontStyle: 'bold', prefix: 'Rs. ' },
  { id: 'paybackPeriodP7', label: 'Payback Period', page: 7, type: 'text', defaultValue: '', x: 0.13, y: 0.855, color: orangeColor, fontSize: 0.012, fontStyle: 'bold' },

  // Page 8 (BoM Table)
  {
    id: 'bom', label: 'Bill of Materials', page: 8, type: 'bom_table', startY: 0.366, rowHeight: 0.0416,
    color: greyColor, fontSize: 0.010, fontStyle: 'normal',
    items: ['Solar Modules', 'Inverter', 'Structure', 'DC Cable', 'AC Cable', 'ACDB / DCDB', 'Earthing Kit', 'Surge Protection', 'Junction Box', 'Monitoring System', 'Net Meter', 'Misc BOS'],
  },
];

export interface BomRow { make: string; spec: string; unit: string; qty: string }
export const emptyBom = (): BomRow[] => Array.from({ length: 12 }, () => ({ make: '', spec: '', unit: '', qty: '' }));
