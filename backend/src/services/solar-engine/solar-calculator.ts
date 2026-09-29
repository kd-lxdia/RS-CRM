
// =============================================================================
// SLAR CRM — Native Solar Calculation Engine
// All math is self-contained. Zero external API calls.
// =============================================================================

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface MonthlyGeneration {
  month: string;
  peakSunHours: number;
  days: number;
  kwh: number;
}

export interface SubsidySlab {
  label: string;
  kwCovered: number;
  ratePerKw: number;
  amount: number;
}

export interface YearlyProjection {
  year: number;
  generationKwh: number;
  tariffPerUnit: number;
  annualSavings: number;
  cumulativeSavings: number;
}

export interface FinancialResult {
  netCost: number;
  annualSavingsYear1: number;
  paybackYears: number;
  lifetimeSavings: number;
  roi25yr: number;
  irr: number;
  emi: number | null;
  loanTotalCost: number | null;
  yearlyProjection: YearlyProjection[];
}

export interface CO2Result {
  co2KgPerYear: number;
  co2TonnesPer25yr: number;
  treesEquivalent: number;
}

export interface InverterSpec {
  maxInputVoltage: number;
  mpptVoltageMin: number;
  mpptVoltageMax: number;
  maxInputCurrent: number;
  mpptCount: number;
}

export interface PanelSpec {
  voc: number;
  vmpp: number;
  isc: number;
  impp: number;
  tempCoeffVoc: number; // e.g. -0.0028 means -0.28%/°C
}

export interface StringConfig {
  stringsCount: number;
  panelsPerString: number;
  configLabel: string;
  winterVoc: number;
  summerVmpp: number;
  isValid: boolean;
  warnings: string[];
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DELHI_MONTHLY_PSH: Record<string, number> = {
  Jan: 4.8, Feb: 5.2, Mar: 5.8, Apr: 6.2, May: 6.5, Jun: 5.5,
  Jul: 4.5, Aug: 4.8, Sep: 5.2, Oct: 5.5, Nov: 5.0, Dec: 4.6,
};

const DAYS_IN_MONTH: Record<string, number> = {
  Jan: 31, Feb: 28, Mar: 31, Apr: 30, May: 31, Jun: 30,
  Jul: 31, Aug: 31, Sep: 30, Oct: 31, Nov: 30, Dec: 31,
};

// Roof area per panel in sq ft, keyed by wattage
const PANEL_AREA_SQFT: Record<number, number> = {
  580: 32,
  540: 30,
  440: 26,
  415: 25,
  400: 24,
};

const CO2_EMISSION_FACTOR_KG_PER_KWH = 0.716; // India grid emission factor
const AVG_TREE_ABSORPTION_KG_PER_YR = 21.7;

// PM Surya Ghar slab defaults (can be overridden via admin config)
const PM_SURYA_GHAR_SLABS = [
  { upToKw: 1, ratePerKw: 30000 },
  { upToKw: 2, ratePerKw: 30000 },
  { upToKw: 3, ratePerKw: 18000 },
  { upToKw: Infinity, ratePerKw: 0, cap: 78000 },
];

// Delhi CM Scheme defaults
const CM_SCHEME_DELHI = {
  upTo3kw: { ratePerKw: 2000 },
  above3kw: { flat: 6000 },
};

// ─── 1. SYSTEM SIZING ────────────────────────────────────────────────────────

export function recommendSystemSize(input: {
  monthlyBillAvg: number;
  tariffPerUnit: number;
  peakSunHours?: number;
  systemEfficiency?: number;
}): { recommendedKw: number; monthlyConsumptionKwh: number } {
  const {
    monthlyBillAvg,
    tariffPerUnit,
    peakSunHours = 5.5,
    systemEfficiency = 0.80,
  } = input;

  if (tariffPerUnit <= 0) throw new Error('tariffPerUnit must be > 0');
  if (peakSunHours <= 0) throw new Error('peakSunHours must be > 0');

  const monthlyConsumptionKwh = monthlyBillAvg / tariffPerUnit;
  const dailyConsumptionKwh = monthlyConsumptionKwh / 30;
  const rawKw = dailyConsumptionKwh / (peakSunHours * systemEfficiency);

  // Round up to nearest 0.5 kW
  const recommendedKw = Math.ceil(rawKw * 2) / 2;

  return { recommendedKw, monthlyConsumptionKwh };
}

// ─── 2. PANEL COUNT ──────────────────────────────────────────────────────────

export function calculatePanelCount(systemKw: number, panelWattage: number): number {
  if (systemKw <= 0) throw new Error('systemKw must be > 0');
  if (panelWattage <= 0) throw new Error('panelWattage must be > 0');
  return Math.ceil((systemKw * 1000) / panelWattage);
}

// ─── 3. ANNUAL GENERATION ────────────────────────────────────────────────────

export function calculateAnnualGeneration(input: {
  systemKw: number;
  performanceRatio?: number;
  peakSunHours?: number;
}): { annualKwh: number; monthlyBreakdown: MonthlyGeneration[] } {
  const { systemKw, performanceRatio = 0.75 } = input;

  if (systemKw <= 0) throw new Error('systemKw must be > 0');

  const monthlyBreakdown: MonthlyGeneration[] = Object.entries(DELHI_MONTHLY_PSH).map(
    ([month, psh]) => {
      const days = DAYS_IN_MONTH[month];
      const kwh = systemKw * performanceRatio * psh * days;
      return { month, peakSunHours: psh, days, kwh: Math.round(kwh) };
    }
  );

  const annualKwh = monthlyBreakdown.reduce((sum, m) => sum + m.kwh, 0);

  return { annualKwh, monthlyBreakdown };
}

// ─── 4. SUBSIDY CALCULATION ──────────────────────────────────────────────────

export function calculateSubsidy(input: {
  systemKw: number;
  scheme: 'PM_SURYA_GHAR' | 'CM_SCHEME' | 'BOTH' | 'NONE';
  state?: string;
}): {
  pmSuryaGharAmount: number;
  cmSchemeAmount: number;
  totalSubsidy: number;
  slabBreakdown: SubsidySlab[];
} {
  const { systemKw, scheme, state = 'DELHI' } = input;

  let pmSuryaGharAmount = 0;
  let cmSchemeAmount = 0;
  const slabBreakdown: SubsidySlab[] = [];

  // ── PM Surya Ghar ──
  if (scheme === 'PM_SURYA_GHAR' || scheme === 'BOTH') {
    let remaining = systemKw;
    let prevKw = 0;
    let total = 0;

    // Slab 1: 0–1 kW → ₹30,000/kW
    if (remaining > 0) {
      const covered = Math.min(remaining, 1);
      const amount = covered * 30000;
      slabBreakdown.push({ label: '0–1 kW', kwCovered: covered, ratePerKw: 30000, amount });
      total += amount;
      remaining -= covered;
      prevKw += covered;
    }

    // Slab 2: 1–2 kW → ₹30,000/kW
    if (remaining > 0) {
      const covered = Math.min(remaining, 1);
      const amount = covered * 30000;
      slabBreakdown.push({ label: '1–2 kW', kwCovered: covered, ratePerKw: 30000, amount });
      total += amount;
      remaining -= covered;
      prevKw += covered;
    }

    // Slab 3: 2–3 kW → ₹18,000/kW
    if (remaining > 0) {
      const covered = Math.min(remaining, 1);
      const amount = covered * 18000;
      slabBreakdown.push({ label: '2–3 kW', kwCovered: covered, ratePerKw: 18000, amount });
      total += amount;
      remaining -= covered;
    }

    // Cap at ₹78,000
    pmSuryaGharAmount = Math.min(total, 78000);
    if (total > 78000) {
      slabBreakdown.push({ label: 'Cap applied', kwCovered: 0, ratePerKw: 0, amount: -(total - 78000) });
    }
  }

  // ── Delhi CM Scheme ──
  if ((scheme === 'CM_SCHEME' || scheme === 'BOTH') && state.toUpperCase() === 'DELHI') {
    if (systemKw <= 3) {
      cmSchemeAmount = systemKw * CM_SCHEME_DELHI.upTo3kw.ratePerKw;
      slabBreakdown.push({ label: 'Delhi CM (≤3kW)', kwCovered: systemKw, ratePerKw: 2000, amount: cmSchemeAmount });
    } else {
      cmSchemeAmount = CM_SCHEME_DELHI.above3kw.flat;
      slabBreakdown.push({ label: 'Delhi CM (>3kW flat)', kwCovered: systemKw, ratePerKw: 0, amount: cmSchemeAmount });
    }
  }

  const totalSubsidy = pmSuryaGharAmount + cmSchemeAmount;

  return { pmSuryaGharAmount, cmSchemeAmount, totalSubsidy, slabBreakdown };
}

// ─── 5. FINANCIAL CALCULATIONS ───────────────────────────────────────────────

function calculateEMI(principal: number, annualRatePercent: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return principal / tenureMonths;
  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return Math.round(emi);
}

function calculateIRR(cashFlows: number[]): number {
  // Newton-Raphson iteration
  let rate = 0.1; // initial guess 10%
  const MAX_ITER = 100;
  const TOLERANCE = 0.0001;

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0;
    let dnpv = 0; // derivative

    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / factor;
      dnpv -= (t * cashFlows[t]) / (factor * (1 + rate));
    }

    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < TOLERANCE) {
      return Math.round(newRate * 10000) / 100; // as %
    }
    rate = newRate;
  }

  return Math.round(rate * 10000) / 100;
}

export function calculateFinancials(input: {
  totalSystemCost: number;
  subsidyAmount: number;
  annualKwh: number;
  tariffPerUnit: number;
  annualTariffEscalation?: number;
  systemLifeYears?: number;
  loanAmount?: number;
  loanRatePercent?: number;
  loanTenureMonths?: number;
}): FinancialResult {
  const {
    totalSystemCost,
    subsidyAmount,
    annualKwh,
    tariffPerUnit,
    annualTariffEscalation = 0.03,
    systemLifeYears = 25,
    loanAmount,
    loanRatePercent,
    loanTenureMonths,
  } = input;

  const netCost = totalSystemCost - subsidyAmount;
  const annualSavingsYear1 = annualKwh * tariffPerUnit;

  // Build yearly projections with tariff escalation
  const yearlyProjection: YearlyProjection[] = [];
  let cumulative = 0;
  let totalSavings = 0;

  for (let y = 1; y <= systemLifeYears; y++) {
    const currentTariff = tariffPerUnit * Math.pow(1 + annualTariffEscalation, y - 1);
    // Generation degrades ~0.5% per year
    const degradationFactor = Math.pow(0.995, y - 1);
    const generationKwh = Math.round(annualKwh * degradationFactor);
    const savings = Math.round(generationKwh * currentTariff);
    cumulative += savings;
    totalSavings += savings;

    yearlyProjection.push({
      year: y,
      generationKwh,
      tariffPerUnit: Math.round(currentTariff * 100) / 100,
      annualSavings: savings,
      cumulativeSavings: cumulative,
    });
  }

  // Payback: when cumulative savings crosses net cost
  let paybackYears = systemLifeYears; // worst case
  let accum = 0;
  for (const row of yearlyProjection) {
    accum += row.annualSavings;
    if (accum >= netCost) {
      const previousAccum = accum - row.annualSavings;
      const fraction = (netCost - previousAccum) / row.annualSavings;
      paybackYears = Math.round((row.year - 1 + fraction) * 10) / 10;
      break;
    }
  }

  const lifetimeSavings = totalSavings;
  const roi25yr = Math.round(((lifetimeSavings - netCost) / netCost) * 10000) / 100;

  // IRR
  const cashFlows = [-netCost, ...yearlyProjection.map((y) => y.annualSavings)];
  const irr = calculateIRR(cashFlows);

  // EMI
  let emi: number | null = null;
  let loanTotalCost: number | null = null;

  if (loanAmount != null && loanRatePercent != null && loanTenureMonths != null) {
    emi = calculateEMI(loanAmount, loanRatePercent, loanTenureMonths);
    loanTotalCost = Math.round(emi * loanTenureMonths);
  }

  return {
    netCost,
    annualSavingsYear1,
    paybackYears,
    lifetimeSavings,
    roi25yr,
    irr,
    emi,
    loanTotalCost,
    yearlyProjection,
  };
}

// ─── 6. CO2 SAVINGS ──────────────────────────────────────────────────────────

export function calculateCO2(annualKwh: number): CO2Result {
  if (annualKwh < 0) throw new Error('annualKwh must be >= 0');
  const co2KgPerYear = Math.round(annualKwh * CO2_EMISSION_FACTOR_KG_PER_KWH);
  const co2TonnesPer25yr = Math.round((co2KgPerYear * 25) / 1000 * 10) / 10;
  const treesEquivalent = Math.round((co2TonnesPer25yr * 1000) / AVG_TREE_ABSORPTION_KG_PER_YR);

  return { co2KgPerYear, co2TonnesPer25yr, treesEquivalent };
}

// ─── 7. ROOF AREA VALIDATOR ──────────────────────────────────────────────────

function getAreaPerPanel(panelWattage: number): number {
  // Find closest wattage key
  const wattages = Object.keys(PANEL_AREA_SQFT).map(Number).sort((a, b) => a - b);
  for (const w of wattages) {
    if (panelWattage <= w) return PANEL_AREA_SQFT[w];
  }
  // Bigger than known — use highest available ratio (580W = 32sqft), scale up
  const ratio = PANEL_AREA_SQFT[580] / 580; // sqft per watt
  return Math.ceil(panelWattage * ratio);
}

export function validateRoofForSystem(input: {
  roofAreaSqFt: number;
  systemKw: number;
  panelWattage: number;
}): {
  fits: boolean;
  requiredSqFt: number;
  availableSqFt: number;
  maxKwForRoof: number;
} {
  const { roofAreaSqFt, systemKw, panelWattage } = input;

  const panelCount = calculatePanelCount(systemKw, panelWattage);
  const sqPerPanel = getAreaPerPanel(panelWattage);

  // Account for 1.5× row spacing shadow clearance
  const effectiveAreaPerPanel = sqPerPanel * 1.5;
  const requiredSqFt = Math.ceil(panelCount * effectiveAreaPerPanel);

  const maxPanels = Math.floor(roofAreaSqFt / effectiveAreaPerPanel);
  const maxKwForRoof = Math.round((maxPanels * panelWattage) / 100) / 10;

  return {
    fits: roofAreaSqFt >= requiredSqFt,
    requiredSqFt,
    availableSqFt: roofAreaSqFt,
    maxKwForRoof,
  };
}

// ─── 8. STRING CONFIGURATION ─────────────────────────────────────────────────

export function calculateStringConfig(input: {
  panelCount: number;
  inverterModel: InverterSpec;
  panelSpec: PanelSpec;
  minAmbientTemp?: number;
  maxAmbientTemp?: number;
}): StringConfig {
  const {
    panelCount,
    inverterModel,
    panelSpec,
    minAmbientTemp = -5,  // Delhi winter worst case
    maxAmbientTemp = 45,  // Delhi summer worst case
  } = input;

  const warnings: string[] = [];

  // Voc temp correction: Voc(T) = Voc(STC) × (1 + tempCoeffVoc × (T - 25))
  // coldest day → highest Voc — safety constraint
  const vocWinterFactor = 1 + panelSpec.tempCoeffVoc * (minAmbientTemp - 25);
  // hottest day → lowest Vmpp — must stay above MPPT min
  // Note: Panel cell temperature in direct summer sunlight is typically ambient + 30°C
  const maxCellTemp = maxAmbientTemp + 30;
  const vmppSummerFactor = 1 + panelSpec.tempCoeffVoc * (maxCellTemp - 25);

  // Determine max panels per string (limited by inverter max input voltage)
  const maxPanelsPerString = Math.floor(inverterModel.maxInputVoltage / (panelSpec.voc * vocWinterFactor));
  // Determine min panels per string (MPPT min must be satisfied in summer)
  const minPanelsPerString = Math.ceil(inverterModel.mpptVoltageMin / (panelSpec.vmpp * vmppSummerFactor));

  // Aim for an optimal panels-per-string in the valid range
  const optimalPanelsPerString = Math.min(
    maxPanelsPerString,
    Math.ceil(panelCount / inverterModel.mpptCount)
  );

  const panelsPerString = Math.max(minPanelsPerString, Math.min(optimalPanelsPerString, maxPanelsPerString));
  const stringsCount = Math.ceil(panelCount / panelsPerString);

  const winterVoc = Math.round(panelSpec.voc * vocWinterFactor * panelsPerString * 100) / 100;
  const summerVmpp = Math.round(panelSpec.vmpp * vmppSummerFactor * panelsPerString * 100) / 100;

  let isValid = true;

  if (winterVoc > inverterModel.maxInputVoltage) {
    warnings.push(`Winter Voc (${winterVoc}V) exceeds inverter max input voltage (${inverterModel.maxInputVoltage}V). Reduce panels per string.`);
    isValid = false;
  }

  if (summerVmpp < inverterModel.mpptVoltageMin) {
    warnings.push(`Summer Vmpp (${summerVmpp}V) is below inverter MPPT min (${inverterModel.mpptVoltageMin}V). Increase panels per string.`);
    isValid = false;
  }

  if (summerVmpp > inverterModel.mpptVoltageMax) {
    warnings.push(`Summer Vmpp (${summerVmpp}V) exceeds inverter MPPT max (${inverterModel.mpptVoltageMax}V).`);
    isValid = false;
  }

  if (stringsCount > inverterModel.mpptCount) {
    warnings.push(`String count (${stringsCount}) exceeds inverter MPPT count (${inverterModel.mpptCount}).`);
    isValid = false;
  }

  const configLabel = `${stringsCount}S × ${panelsPerString}P`;

  return {
    stringsCount,
    panelsPerString,
    configLabel,
    winterVoc,
    summerVmpp,
    isValid,
    warnings,
  };
}
