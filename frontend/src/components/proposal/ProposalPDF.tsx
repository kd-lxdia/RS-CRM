/**
 * ProposalPDF.tsx — 7-page react-pdf proposal document
 * Uses @react-pdf/renderer for fully client-side PDF generation.
 */

import {
  Document, Page, Text, View, StyleSheet, Font, Image,
  Svg, Line as SvgLine,
} from '@react-pdf/renderer';

// ─── Register Fonts (system fallback is fine for now) ────────────────────────

const colors = {
  navy:     '#0f172a',
  blue:     '#1d4ed8',
  lightBlue:'#dbeafe',
  green:    '#16a34a',
  lightGreen:'#dcfce7',
  amber:    '#d97706',
  slate:    '#64748b',
  lightGray:'#f8fafc',
  border:   '#e2e8f0',
  white:    '#ffffff',
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { backgroundColor: colors.white, padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: colors.navy },
  coverPage: { backgroundColor: colors.navy, padding: 0 },

  // Cover elements
  coverHeader: { backgroundColor: colors.blue, paddingHorizontal: 40, paddingVertical: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  logoText: { fontSize: 22, fontWeight:'bold', color: colors.white, fontFamily:'Helvetica-Bold' },
  tagline: { fontSize: 9, color: '#93c5fd' },
  coverBody: { flex: 1, paddingHorizontal: 48, paddingVertical: 40, justifyContent:'center' },
  coverBadge: { backgroundColor: colors.blue, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignSelf:'flex-start', marginBottom: 20 },
  coverBadgeText: { color: colors.white, fontSize: 10, fontFamily:'Helvetica-Bold' },
  coverTitle: { fontSize: 32, fontFamily:'Helvetica-Bold', color: colors.white, lineHeight: 1.2, marginBottom: 10 },
  coverSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 30 },
  coverMeta: { flexDirection:'row', gap: 40, marginTop: 20 },
  coverMetaItem: { gap: 4 },
  coverMetaLabel: { fontSize: 8, color: '#94a3b8', textTransform:'uppercase', letterSpacing: 1 },
  coverMetaValue: { fontSize: 12, color: colors.white, fontFamily:'Helvetica-Bold' },
  coverFooter: { backgroundColor: '#0c4a6e', paddingHorizontal: 40, paddingVertical: 14, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  coverFooterText: { fontSize: 8, color: '#94a3b8' },

  // Page header
  pageHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: colors.blue },
  pageHeaderTitle: { fontSize: 14, fontFamily:'Helvetica-Bold', color: colors.blue },
  pageHeaderLogo: { fontSize: 10, fontFamily:'Helvetica-Bold', color: colors.slate },

  // Section
  sectionTitle: { fontSize: 10, fontFamily:'Helvetica-Bold', color: colors.navy, marginBottom: 8, marginTop: 14, textTransform:'uppercase', letterSpacing: 0.5 },

  // Table
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, overflow:'hidden', marginBottom: 12 },
  tableHeader: { flexDirection:'row', backgroundColor: colors.navy, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { color: colors.white, fontSize: 8, fontFamily:'Helvetica-Bold', flex: 1 },
  tableRow: { flexDirection:'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowAlt: { backgroundColor: colors.lightGray },
  tableCell: { fontSize: 8, color: colors.navy, flex: 1 },
  tableCellRight: { fontSize: 8, color: colors.navy, flex: 1, textAlign:'right' },
  tableCellBold: { fontSize: 8, color: colors.navy, flex: 1, fontFamily:'Helvetica-Bold' },
  tableSummaryRow: { flexDirection:'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: colors.lightBlue },
  tableSummaryLabel: { fontSize: 9, fontFamily:'Helvetica-Bold', color: colors.navy, flex: 2 },
  tableSummaryValue: { fontSize: 10, fontFamily:'Helvetica-Bold', color: colors.blue, flex: 1, textAlign:'right' },

  // KPI cards
  kpiRow: { flexDirection:'row', gap: 10, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: colors.lightGray, borderRadius: 6, padding: 10, alignItems:'center', borderWidth: 1, borderColor: colors.border },
  kpiLabel: { fontSize: 7, color: colors.slate, textTransform:'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  kpiValue: { fontSize: 15, fontFamily:'Helvetica-Bold', color: colors.blue },
  kpiUnit: { fontSize: 7, color: colors.slate, marginTop: 2 },

  // Spec chip
  chip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 4 },
  chipBlue: { backgroundColor: colors.lightBlue },
  chipGreen: { backgroundColor: colors.lightGreen },

  // Footer
  pageFooter: { position:'absolute', bottom: 18, left: 36, right: 36, flexDirection:'row', justifyContent:'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  pageFooterText: { fontSize: 7, color: colors.slate },

  infoBlock: { backgroundColor: colors.lightBlue, borderRadius: 6, padding: 10, marginBottom: 10 },
  infoLabel: { fontSize: 7.5, color: colors.blue, fontFamily:'Helvetica-Bold' },
  infoValue: { fontSize: 10, color: colors.navy, fontFamily:'Helvetica-Bold', marginTop: 2 },
});

// ─── Helper components ────────────────────────────────────────────────────────

const PageHeader = ({ title }: { title: string }) => (
  <View style={s.pageHeader}>
    <Text style={s.pageHeaderTitle}>{title}</Text>
    <Text style={s.pageHeaderLogo}>⚡ Slar Solar</Text>
  </View>
);

const PageFooter = ({ pageNum, customerName }: { pageNum: number; customerName: string }) => (
  <View style={s.pageFooter} fixed>
    <Text style={s.pageFooterText}>Slar Solar · Confidential Proposal</Text>
    <Text style={s.pageFooterText}>{customerName} · Page {pageNum}</Text>
    <Text style={s.pageFooterText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }
function fmtKw(n: number) { return `${n.toFixed(1)} kW`; }

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProposalData {
  customerName: string;
  address: string;
  date: string;
  systemKw: number;
  panelCount: number;
  panelBrand: string;
  panelModel: string;
  panelWattage: number;
  panelWarranty: number;
  inverterBrand: string;
  inverterModel: string;
  inverterKw: number;
  strings: number;
  panelsPerString: number;
  annualKwhGeneration: number;
  monthlyKwh: number[];              // 12 values
  systemCost: number;
  panelCost: number;
  inverterCost: number;
  mountingCost: number;
  cablesCost: number;
  installCost: number;
  gstAmount: number;
  totalSubsidy: number;
  netCost: number;
  loanEnabled: boolean;
  loanAmount?: number;
  emi?: number;
  loanTenure?: number;
  paybackYears: number;
  irr: number;
  lifetimeSavings: number;
  annualSavings: number;
  co2Tonnes: number;
  treesEquivalent: number;
  roofScreenshot?: string;           // base64 from Three.js canvas
  mapScreenshot?: string;            // base64 from Leaflet canvas
  layoutScreenshot?: string;         // base64 top-view
  preparedBy?: string;
}

// ─── Monthly generation (seasonal variation for Delhi) ────────────────────────

const MONTHLY_FACTORS = [0.80, 0.86, 0.94, 0.99, 1.02, 0.96, 0.84, 0.83, 0.93, 0.99, 0.92, 0.82];
function buildMonthlyGen(annualKwh: number): number[] {
  const total = MONTHLY_FACTORS.reduce((a, b) => a + b, 0);
  return MONTHLY_FACTORS.map(f => Math.round(annualKwh * f / total));
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Pages ───────────────────────────────────────────────────────────────────

const CoverPage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.coverPage}>
    <View style={s.coverHeader}>
      <View>
        <Text style={s.logoText}>⚡ SLAR</Text>
        <Text style={s.tagline}>Powering India's Solar Transition</Text>
      </View>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={{ color:'#93c5fd', fontSize: 8 }}>PROPOSAL DATE</Text>
        <Text style={{ color: colors.white, fontSize: 10, fontFamily:'Helvetica-Bold' }}>{data.date}</Text>
      </View>
    </View>

    <View style={s.coverBody}>
      <View style={s.coverBadge}>
        <Text style={s.coverBadgeText}>Solar Installation Proposal</Text>
      </View>
      <Text style={s.coverTitle}>{fmtKw(data.systemKw)} Rooftop{'\n'}Solar System</Text>
      <Text style={s.coverSubtitle}>{data.customerName}</Text>
      <Text style={{ color:'#64748b', fontSize: 9, marginBottom: 30 }}>{data.address}</Text>

      {data.roofScreenshot && (
        <Image src={data.roofScreenshot} style={{ height: 140, borderRadius: 8, objectFit:'cover', marginBottom: 24 }} />
      )}

      <View style={s.coverMeta}>
        {[
          { label: 'Panels', value: `${data.panelCount}` },
          { label: 'Annual Output', value: `${data.annualKwhGeneration.toLocaleString()} kWh` },
          { label: 'Net Cost', value: fmt(data.netCost) },
          { label: 'Payback', value: `${data.paybackYears} yrs` },
        ].map(item => (
          <View key={item.label} style={s.coverMetaItem}>
            <Text style={s.coverMetaLabel}>{item.label}</Text>
            <Text style={s.coverMetaValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={s.coverFooter}>
      <Text style={s.coverFooterText}>Prepared by {data.preparedBy || 'Slar Solar Representative'}</Text>
      <Text style={s.coverFooterText}>Confidential · Valid 30 days from {data.date}</Text>
    </View>
  </Page>
);

const SiteAnalysisPage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.page}>
    <PageHeader title="2. Site Analysis" />

    {data.mapScreenshot ? (
      <Image src={data.mapScreenshot} style={{ height: 180, borderRadius: 6, marginBottom: 12, objectFit:'cover' }} />
    ) : (
      <View style={{ height: 100, backgroundColor: colors.lightGray, borderRadius: 6, alignItems:'center', justifyContent:'center', marginBottom: 12 }}>
        <Text style={{ color: colors.slate, fontSize: 9 }}>Satellite map image (captured from Leaflet)</Text>
      </View>
    )}

    <Text style={s.sectionTitle}>Roof Parameters</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Parameter</Text>
        <Text style={s.tableHeaderCell}>Value</Text>
      </View>
      {[
        ['Site Address', data.address],
        ['System Capacity', fmtKw(data.systemKw)],
        ['Panel Orientation', `South-facing, ${data.systemKw > 5 ? 'Portrait' : 'Portrait'}`],
        ['Peak Sun Hours', '5.5 hours/day (Delhi avg)'],
        ['Performance Ratio', '80%'],
      ].map(([label, value], i) => (
        <View key={label} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, s.tableCellBold, { flex: 2 }]}>{label}</Text>
          <Text style={s.tableCell}>{value}</Text>
        </View>
      ))}
    </View>

    <Text style={s.sectionTitle}>Shading Assessment</Text>
    <View style={s.infoBlock}>
      <Text style={s.infoLabel}>SHADING STATUS</Text>
      <Text style={s.infoValue}>Minimal Shading — Optimal Site</Text>
      <Text style={{ fontSize: 8, color: colors.navy, marginTop: 6 }}>
        Site analysis confirms less than 5% annual energy loss from shading. No significant obstructions identified within the solar window (9am–3pm, year-round).
      </Text>
    </View>

    <PageFooter pageNum={2} customerName={data.customerName} />
  </Page>
);

const SpecsPage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.page}>
    <PageHeader title="3. System Specifications" />

    <Text style={s.sectionTitle}>Solar Panel Specifications</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Specification</Text>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Details</Text>
      </View>
      {[
        ['Brand & Model', `${data.panelBrand} ${data.panelModel}`],
        ['Rated Power', `${data.panelWattage}W per panel`],
        ['Number of Panels', `${data.panelCount} panels`],
        ['Total Capacity', fmtKw(data.systemKw)],
        ['Panel Warranty', `${data.panelWarranty} years performance, 10 years product`],
        ['Technology', 'Mono PERC Half-Cut'],
      ].map(([label, value], i) => (
        <View key={label} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCellBold, { flex: 2 }]}>{label}</Text>
          <Text style={[s.tableCell, { flex: 2 }]}>{value}</Text>
        </View>
      ))}
    </View>

    <Text style={s.sectionTitle}>Inverter Specifications</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Specification</Text>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Details</Text>
      </View>
      {[
        ['Brand & Model', `${data.inverterBrand} ${data.inverterModel}`],
        ['Capacity', `${data.inverterKw} kW`],
        ['Inverter Warranty', '5 years standard + 5 years extended available'],
        ['Grid Connection', '3-phase, BIS IS 16169 compliant'],
        ['Monitoring', 'Wi-Fi + app monitoring included'],
      ].map(([label, value], i) => (
        <View key={label} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCellBold, { flex: 2 }]}>{label}</Text>
          <Text style={[s.tableCell, { flex: 2 }]}>{value}</Text>
        </View>
      ))}
    </View>

    <Text style={s.sectionTitle}>String Configuration</Text>
    <View style={s.infoBlock}>
      <Text style={s.infoLabel}>ELECTRICAL LAYOUT</Text>
      <Text style={s.infoValue}>{data.strings}S × {data.panelsPerString}P configuration</Text>
      <Text style={{ fontSize: 8, color: colors.navy, marginTop: 6 }}>
        {data.strings} string(s) of {data.panelsPerString} panels each. All strings balanced for maximum inverter MPPT efficiency.
      </Text>
    </View>

    {data.layoutScreenshot && (
      <Image src={data.layoutScreenshot} style={{ height: 130, borderRadius: 6, objectFit:'contain', marginTop: 8 }} />
    )}

    <PageFooter pageNum={3} customerName={data.customerName} />
  </Page>
);

const EnergyPage = ({ data }: { data: ProposalData }) => {
  const monthly = data.monthlyKwh?.length === 12 ? data.monthlyKwh : buildMonthlyGen(data.annualKwhGeneration);
  const maxKwh = Math.max(...monthly);

  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="4. Energy Production" />

      <Text style={s.sectionTitle}>Monthly Generation Forecast (kWh)</Text>
      {/* Simple bar chart using SVG */}
      <View style={{ height: 90, marginBottom: 8 }}>
        <Svg width="100%" height="90" viewBox="0 0 520 90">
          {monthly.map((kwh, i) => {
            const barH = (kwh / maxKwh) * 70;
            const x = i * 43 + 4;
            return (
              <SvgLine key={i} x1={x + 18} y1={90 - barH} x2={x + 18} y2={88}
                stroke="#1d4ed8" strokeWidth="30" strokeLinecap="round" opacity="0.85" />
            );
          })}
        </Svg>
        <View style={{ flexDirection:'row', marginTop:-6 }}>
          {MONTH_SHORT.map(m => (
            <Text key={m} style={{ flex: 1, fontSize: 6.5, textAlign:'center', color: colors.slate }}>{m}</Text>
          ))}
        </View>
      </View>

      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={s.tableHeaderCell}>Month</Text>
          <Text style={[s.tableHeaderCell, { textAlign:'right' }]}>Generation (kWh)</Text>
        </View>
        {monthly.map((kwh, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={s.tableCell}>{MONTH_SHORT[i]}</Text>
            <Text style={[s.tableCell, { textAlign:'right' }]}>{kwh.toLocaleString()} kWh</Text>
          </View>
        ))}
        <View style={s.tableSummaryRow}>
          <Text style={s.tableSummaryLabel}>Annual Total</Text>
          <Text style={s.tableSummaryValue}>{data.annualKwhGeneration.toLocaleString()} kWh</Text>
        </View>
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Annual Output</Text>
          <Text style={s.kpiValue}>{data.annualKwhGeneration.toLocaleString()}</Text>
          <Text style={s.kpiUnit}>kWh / year</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Avg Monthly Savings</Text>
          <Text style={s.kpiValue}>{fmt(Math.round(data.annualSavings / 12))}</Text>
          <Text style={s.kpiUnit}>per month</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>CO₂ Saved (25yr)</Text>
          <Text style={{ fontSize: 12, fontFamily:'Helvetica-Bold', color: '#16a34a' }}>{data.co2Tonnes}t</Text>
          <Text style={s.kpiUnit}>= {data.treesEquivalent} trees</Text>
        </View>
      </View>

      <PageFooter pageNum={4} customerName={data.customerName} />
    </Page>
  );
};

const FinancialsPage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.page}>
    <PageHeader title="5. Financial Summary" />

    <Text style={s.sectionTitle}>Cost Breakdown</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { flex: 3 }]}>Item</Text>
        <Text style={[s.tableHeaderCell, { textAlign:'right' }]}>Amount</Text>
      </View>
      {[
        ['Solar Panels (incl. 12% GST)', data.panelCost],
        ['Inverter (incl. 18% GST)', data.inverterCost],
        ['Mounting Structure (incl. 12% GST)', data.mountingCost],
        ['Cables & Accessories', data.cablesCost],
        ['Installation & Commissioning (incl. 18% GST)', data.installCost],
      ].map(([label, amount], i) => (
        <View key={String(label)} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, { flex: 3 }]}>{label}</Text>
          <Text style={[s.tableCell, { textAlign:'right' }]}>{fmt(Number(amount))}</Text>
        </View>
      ))}
      <View style={s.tableSummaryRow}>
        <Text style={[s.tableSummaryLabel, { flex: 3 }]}>Total System Cost</Text>
        <Text style={s.tableSummaryValue}>{fmt(data.systemCost)}</Text>
      </View>
    </View>

    {data.totalSubsidy > 0 && (
      <>
        <Text style={s.sectionTitle}>Government Subsidy</Text>
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 3 }]}>Scheme</Text>
            <Text style={[s.tableHeaderCell, { textAlign:'right' }]}>Amount</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 3 }]}>PM Surya Ghar Yojana</Text>
            <Text style={[s.tableCell, { textAlign:'right', color: colors.green }]}>{fmt(data.totalSubsidy)}</Text>
          </View>
          <View style={s.tableSummaryRow}>
            <Text style={[s.tableSummaryLabel, { flex: 3 }]}>Total Subsidy</Text>
            <Text style={[s.tableSummaryValue, { color: colors.green }]}>{fmt(data.totalSubsidy)}</Text>
          </View>
        </View>
      </>
    )}

    {/* Net cost highlight */}
    <View style={{ backgroundColor: colors.lightBlue, borderRadius: 8, padding: 12, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12, borderWidth: 1, borderColor: colors.blue }}>
      <Text style={{ fontSize: 11, fontFamily:'Helvetica-Bold', color: colors.navy }}>Net Cost After Subsidy</Text>
      <Text style={{ fontSize: 18, fontFamily:'Helvetica-Bold', color: colors.blue }}>{fmt(data.netCost)}</Text>
    </View>

    {data.loanEnabled && data.emi && (
      <View style={s.infoBlock}>
        <Text style={s.infoLabel}>EMI OPTION</Text>
        <Text style={s.infoValue}>{fmt(data.emi)} / month for {data.loanTenure} months</Text>
        <Text style={{ fontSize: 8, color: colors.navy, marginTop: 4 }}>
          Loan amount: {fmt(data.loanAmount || data.netCost)} · Own the system from Day 1
        </Text>
      </View>
    )}

    {/* KPI row */}
    <View style={s.kpiRow}>
      <View style={s.kpiCard}><Text style={s.kpiLabel}>Payback Period</Text><Text style={s.kpiValue}>{data.paybackYears}</Text><Text style={s.kpiUnit}>years</Text></View>
      <View style={s.kpiCard}><Text style={s.kpiLabel}>25-yr Savings</Text><Text style={s.kpiValue}>₹{Math.round(data.lifetimeSavings / 100000)}L</Text><Text style={s.kpiUnit}>lakhs</Text></View>
      <View style={s.kpiCard}><Text style={s.kpiLabel}>IRR</Text><Text style={s.kpiValue}>{data.irr}%</Text><Text style={s.kpiUnit}>internal rate of return</Text></View>
    </View>

    <PageFooter pageNum={5} customerName={data.customerName} />
  </Page>
);

const PaymentSchedulePage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.page}>
    <PageHeader title="6. Payment Schedule" />
    <Text style={s.sectionTitle}>Milestone-Based Payment Plan</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={[s.tableHeaderCell, { flex: 3 }]}>Milestone</Text>
        <Text style={s.tableHeaderCell}>%</Text>
        <Text style={[s.tableHeaderCell, { textAlign:'right' }]}>Amount</Text>
        <Text style={[s.tableHeaderCell, { textAlign:'right', flex: 2 }]}>Due Date</Text>
      </View>
      {[
        ['Booking & Confirmation', 10],
        ['Material Procurement', 40],
        ['Installation Commenced', 30],
        ['Commissioning & Handover', 20],
      ].map(([label, pct], i) => (
        <View key={String(label)} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, { flex: 3 }]}>{label}</Text>
          <Text style={s.tableCell}>{pct}%</Text>
          <Text style={[s.tableCell, { textAlign:'right' }]}>{fmt(Math.round(data.netCost * Number(pct) / 100))}</Text>
          <Text style={[s.tableCell, { textAlign:'right', flex: 2, color: colors.slate }]}>________________</Text>
        </View>
      ))}
      <View style={s.tableSummaryRow}>
        <Text style={[s.tableSummaryLabel, { flex: 3 }]}>Total</Text>
        <Text style={s.tableSummaryLabel}>100%</Text>
        <Text style={[s.tableSummaryValue]}>{fmt(data.netCost)}</Text>
        <Text style={[s.tableCell, { flex: 2 }]}></Text>
      </View>
    </View>
    <View style={s.infoBlock}>
      <Text style={s.infoLabel}>PAYMENT MODES</Text>
      <Text style={{ fontSize: 8, color: colors.navy, marginTop: 4 }}>
        Bank Transfer (NEFT/RTGS/IMPS) · UPI (PhonePe/GPay/Paytm) · Cheque in favour of "Slar Solar Private Limited"
      </Text>
    </View>
    <PageFooter pageNum={6} customerName={data.customerName} />
  </Page>
);

const WarrantyPage = ({ data }: { data: ProposalData }) => (
  <Page size="A4" style={s.page}>
    <PageHeader title="7. Warranty & Terms" />
    <Text style={s.sectionTitle}>Product & Performance Warranty</Text>
    <View style={s.table}>
      <View style={s.tableHeader}>
        <Text style={s.tableHeaderCell}>Component</Text>
        <Text style={s.tableHeaderCell}>Warranty</Text>
        <Text style={[s.tableHeaderCell, { flex: 2 }]}>Coverage</Text>
      </View>
      {[
        ['Solar Panels', '25 years performance, 10 years product', 'Minimum 80% output at year 25; manufacturing defects'],
        ['Inverter', '5 years standard', 'Electronics, display, firmware — extendable to 10yr'],
        ['Mounting Structure', '10 years structural', 'Corrosion, load-bearing capacity, wind resistance'],
        ['Installation Workmanship', '1 year', 'Wiring, sealing, roof penetrations, mounting alignment'],
        ['Monitoring System', '1 year hardware', 'Wi-Fi gateway, app access, data logging'],
      ].map(([comp, warranty, coverage], i) => (
        <View key={String(comp)} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={s.tableCellBold}>{comp}</Text>
          <Text style={s.tableCell}>{warranty}</Text>
          <Text style={[s.tableCell, { flex: 2 }]}>{coverage}</Text>
        </View>
      ))}
    </View>

    <Text style={s.sectionTitle}>Terms & Conditions</Text>
    {[
      'This proposal is valid for 30 days from issue date. Prices may change due to market conditions.',
      'Installation will be completed within 15–21 working days from booking confirmation and material delivery.',
      'Subsidy claims are processed by MNRE/DISCOM — Slar assists with documentation. Timeline: 60–90 days post-commissioning.',
      'Customer to ensure roof access, electrical supply, and necessary no-objection certificates (for housing societies).',
      'Generation estimates are based on MNRE standard conditions and historical Delhi irradiance data. Actual generation may vary ±10%.',
      'Slar Solar is not liable for acts of God, grid failures, or government policy changes affecting generation or subsidy.',
    ].map((term, i) => (
      <View key={i} style={{ flexDirection:'row', marginBottom: 6 }}>
        <Text style={{ fontSize: 8, color: colors.blue, marginRight: 6, marginTop: 1 }}>•</Text>
        <Text style={{ fontSize: 8, color: colors.navy, flex: 1, lineHeight: 1.4 }}>{term}</Text>
      </View>
    ))}

    <View style={{ marginTop: 24, flexDirection:'row', gap: 60 }}>
      <View style={{ flex: 1 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
          <Text style={{ fontSize: 8, color: colors.slate }}>Customer Signature &amp; Date</Text>
          <Text style={{ fontSize: 9, fontFamily:'Helvetica-Bold', marginTop: 4 }}>{data.customerName}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
          <Text style={{ fontSize: 8, color: colors.slate }}>Authorised Signatory · Slar Solar</Text>
          <Text style={{ fontSize: 9, fontFamily:'Helvetica-Bold', marginTop: 4 }}>{data.preparedBy || '________________'}</Text>
        </View>
      </View>
    </View>

    <PageFooter pageNum={7} customerName={data.customerName} />
  </Page>
);

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ProposalPDF({ data }: { data: ProposalData }) {
  return (
    <Document title={`Solar Proposal — ${data.customerName}`} author="Slar Solar" creator="Slar CRM" language="en">
      <CoverPage data={data} />
      <SiteAnalysisPage data={data} />
      <SpecsPage data={data} />
      <EnergyPage data={data} />
      <FinancialsPage data={data} />
      <PaymentSchedulePage data={data} />
      <WarrantyPage data={data} />
    </Document>
  );
}

export default ProposalPDF;
