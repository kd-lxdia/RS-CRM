// =============================================================================
// Energy Yield Calculator
// =============================================================================

// Monthly Peak Sun Hours for Delhi (kWh/m²/day from IMD data)
const MONTHLY_PSH: number[] = [3.5, 4.2, 5.1, 5.8, 6.2, 6.0, 4.8, 4.5, 5.2, 5.5, 4.5, 3.8];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface EnergyYieldInput {
  panelCount: number;
  moduleWattage: number;       // W
  systemLosses?: number;       // 0-1, default 0.14 (14%)
  degradationRate?: number;    // % per year, default 0.5
  years?: number;              // default 25
}

export interface EnergyYieldResult {
  annualKwh: number;
  monthlyKwh: number[];
  year1Generation: number;
  lifetimeGeneration: number;
  specificYield: number;       // kWh/kWp/year
}

export function calculateEnergyYield(input: EnergyYieldInput): EnergyYieldResult {
  const {
    panelCount,
    moduleWattage,
    systemLosses = 0.14,
    degradationRate = 0.5,
    years = 25,
  } = input;

  const systemKw = (panelCount * moduleWattage) / 1000;

  // Monthly generation
  const monthlyKwh = MONTHLY_PSH.map((psh, i) => {
    return Math.round(panelCount * (moduleWattage / 1000) * psh * DAYS_IN_MONTH[i] * (1 - systemLosses));
  });

  const year1 = monthlyKwh.reduce((s, v) => s + v, 0);

  // Lifetime with degradation
  let lifetime = 0;
  for (let yr = 0; yr < years; yr++) {
    lifetime += year1 * Math.pow(1 - degradationRate / 100, yr);
  }

  const specificYield = systemKw > 0 ? Math.round(year1 / systemKw) : 0;

  return {
    annualKwh: year1,
    monthlyKwh,
    year1Generation: year1,
    lifetimeGeneration: Math.round(lifetime),
    specificYield,
  };
}
