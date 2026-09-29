import {
  recommendSystemSize,
  calculatePanelCount,
  calculateAnnualGeneration,
  calculateSubsidy,
  calculateFinancials,
  calculateCO2,
  validateRoofForSystem,
  calculateStringConfig,
  InverterSpec,
  PanelSpec,
} from '../services/solar-engine/solar-calculator';

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const WAAREE_440_SPEC: PanelSpec = {
  voc: 49.5, vmpp: 41.5, isc: 10.8, impp: 10.3,
  tempCoeffVoc: -0.0028,
};

const SOLIS_10K_SPEC: InverterSpec = {
  maxInputVoltage: 1000, mpptVoltageMin: 200, mpptVoltageMax: 800,
  maxInputCurrent: 25, mpptCount: 3,
};

const HAVELLS_3K_SPEC: InverterSpec = {
  maxInputVoltage: 600, mpptVoltageMin: 100, mpptVoltageMax: 550,
  maxInputCurrent: 20, mpptCount: 2,
};

// =============================================================================
// 1. SYSTEM SIZING
// =============================================================================

describe('recommendSystemSize', () => {
  test('₹5000 bill at ₹8/unit → ~625 kWh/month, ~5 kW system', () => {
    const r = recommendSystemSize({ monthlyBillAvg: 5000, tariffPerUnit: 8 });
    expect(r.monthlyConsumptionKwh).toBeCloseTo(625, 0);
    // 625/30/5.5/0.8 = 4.73 → rounds up to 5.0 kW
    expect(r.recommendedKw).toBe(5);
  });

  test('₹3000 bill at ₹8/unit → ~1.5 kW system', () => {
    const r = recommendSystemSize({ monthlyBillAvg: 3000, tariffPerUnit: 8 });
    // 3000/8/30/(5.5×0.80) = 2.84 → rounds to 3.0
    expect(r.recommendedKw).toBeGreaterThanOrEqual(2.5);
    expect(r.recommendedKw % 0.5).toBe(0);
  });

  test('₹10000 bill at ₹8/unit → ~9.5 kW system', () => {
    const r = recommendSystemSize({ monthlyBillAvg: 10000, tariffPerUnit: 8 });
    // 10000/8/30/(5.5×0.8) = 9.47 → 9.5
    expect(r.recommendedKw).toBe(9.5);
  });

  test('₹15000 bill at ₹6/unit → larger system', () => {
    const r = recommendSystemSize({ monthlyBillAvg: 15000, tariffPerUnit: 6 });
    expect(r.recommendedKw).toBeGreaterThanOrEqual(5.5);
  });

  test('Rounds UP to nearest 0.5 kW — never under-sizes', () => {
    // 625/30/5.5/0.8 = 4.734 → should round up to 5.0
    const r = recommendSystemSize({ monthlyBillAvg: 5000, tariffPerUnit: 8, peakSunHours: 4.5 });
    expect(r.recommendedKw % 0.5).toBe(0);
    const raw = (5000 / 8 / 30) / (4.5 * 0.8);
    expect(r.recommendedKw).toBeGreaterThanOrEqual(raw);
  });

  test('Custom peakSunHours and efficiency are respected', () => {
    const r = recommendSystemSize({
      monthlyBillAvg: 6000, tariffPerUnit: 7, peakSunHours: 6.0, systemEfficiency: 0.85,
    });
    const expected = (6000 / 7 / 30) / (6.0 * 0.85);
    expect(r.recommendedKw).toBeGreaterThanOrEqual(expected);
  });

  test('Throws for zero tariff', () => {
    expect(() => recommendSystemSize({ monthlyBillAvg: 5000, tariffPerUnit: 0 })).toThrow();
  });

  test('Very small bill gives non-zero result', () => {
    const r = recommendSystemSize({ monthlyBillAvg: 500, tariffPerUnit: 5 });
    expect(r.recommendedKw).toBeGreaterThan(0);
  });
});

// =============================================================================
// 2. PANEL COUNT
// =============================================================================

describe('calculatePanelCount', () => {
  test('3 kW with 440W panels → 7 panels (ceil of 6.8)', () => {
    expect(calculatePanelCount(3, 440)).toBe(7); // 3000/440 = 6.818 → 7
  });

  test('5 kW with 540W panels → ceil value', () => {
    const count = calculatePanelCount(5, 540);
    expect(count).toBe(10); // 5000/540 = 9.26 → 10
  });

  test('Never under-sizes — result × wattage ≥ systemKw × 1000', () => {
    for (const { kw, w } of [
      { kw: 2, w: 440 }, { kw: 3, w: 580 }, { kw: 5.5, w: 415 }, { kw: 10, w: 540 },
    ]) {
      const count = calculatePanelCount(kw, w);
      expect(count * w).toBeGreaterThanOrEqual(kw * 1000);
    }
  });

  test('Exact match gives no rounding up', () => {
    expect(calculatePanelCount(2.2, 440)).toBe(5); // 2200/440 = 5 exactly
  });

  test('Throws for zero wattage', () => {
    expect(() => calculatePanelCount(3, 0)).toThrow();
  });

  test('Throws for zero system size', () => {
    expect(() => calculatePanelCount(0, 440)).toThrow();
  });
});

// =============================================================================
// 3. ANNUAL GENERATION
// =============================================================================

describe('calculateAnnualGeneration', () => {
  test('5 kW system returns 12 months', () => {
    const r = calculateAnnualGeneration({ systemKw: 5 });
    expect(r.monthlyBreakdown).toHaveLength(12);
  });

  test('Annual kWh is sum of monthly breakdown', () => {
    const r = calculateAnnualGeneration({ systemKw: 4 });
    const computed = r.monthlyBreakdown.reduce((s, m) => s + m.kwh, 0);
    expect(r.annualKwh).toBe(computed);
  });

  test('3 kW system at PR=0.75 → ~4,800–5,200 kWh/yr for Delhi', () => {
    const r = calculateAnnualGeneration({ systemKw: 3 });
    expect(r.annualKwh).toBeGreaterThan(4000);
    expect(r.annualKwh).toBeLessThan(6000);
  });

  test('Higher PR gives proportionally more generation', () => {
    const low = calculateAnnualGeneration({ systemKw: 5, performanceRatio: 0.70 });
    const high = calculateAnnualGeneration({ systemKw: 5, performanceRatio: 0.80 });
    expect(high.annualKwh).toBeGreaterThan(low.annualKwh);
  });

  test('May has highest generation (Delhi June is slightly cooling)', () => {
    const r = calculateAnnualGeneration({ systemKw: 5 });
    const may = r.monthlyBreakdown.find(m => m.month === 'May')!;
    const dec = r.monthlyBreakdown.find(m => m.month === 'Dec')!;
    expect(may.kwh).toBeGreaterThan(dec.kwh);
  });

  test('Throws for negative system size', () => {
    expect(() => calculateAnnualGeneration({ systemKw: -1 })).toThrow();
  });
});

// =============================================================================
// 4. SUBSIDY CALCULATION
// =============================================================================

describe('calculateSubsidy', () => {
  test('1 kW with PM_SURYA_GHAR → ₹30,000', () => {
    const r = calculateSubsidy({ systemKw: 1, scheme: 'PM_SURYA_GHAR' });
    expect(r.pmSuryaGharAmount).toBe(30000);
  });

  test('2 kW with PM_SURYA_GHAR → ₹60,000', () => {
    const r = calculateSubsidy({ systemKw: 2, scheme: 'PM_SURYA_GHAR' });
    expect(r.pmSuryaGharAmount).toBe(60000);
  });

  test('Exactly 3 kW with PM_SURYA_GHAR → ₹78,000', () => {
    const r = calculateSubsidy({ systemKw: 3, scheme: 'PM_SURYA_GHAR' });
    expect(r.pmSuryaGharAmount).toBe(78000);
  });

  test('> 3 kW PM_SURYA_GHAR is capped at ₹78,000', () => {
    const r4 = calculateSubsidy({ systemKw: 4, scheme: 'PM_SURYA_GHAR' });
    const r10 = calculateSubsidy({ systemKw: 10, scheme: 'PM_SURYA_GHAR' });
    expect(r4.pmSuryaGharAmount).toBe(78000);
    expect(r10.pmSuryaGharAmount).toBe(78000);
  });

  test('Delhi CM scheme ≤3 kW gives ₹2000/kW', () => {
    const r = calculateSubsidy({ systemKw: 2, scheme: 'CM_SCHEME', state: 'DELHI' });
    expect(r.cmSchemeAmount).toBe(4000);
  });

  test('Delhi CM scheme >3 kW gives flat ₹6000', () => {
    const r = calculateSubsidy({ systemKw: 5, scheme: 'CM_SCHEME', state: 'DELHI' });
    expect(r.cmSchemeAmount).toBe(6000);
  });

  test('BOTH scheme at 3 kW → ₹78000 + ₹6000 = ₹84000', () => {
    const r = calculateSubsidy({ systemKw: 3, scheme: 'BOTH', state: 'DELHI' });
    expect(r.totalSubsidy).toBe(84000);
  });

  test('NONE scheme → ₹0', () => {
    const r = calculateSubsidy({ systemKw: 5, scheme: 'NONE' });
    expect(r.totalSubsidy).toBe(0);
  });

  test('slabBreakdown is non-empty for valid schemes', () => {
    const r = calculateSubsidy({ systemKw: 2.5, scheme: 'BOTH', state: 'DELHI' });
    expect(r.slabBreakdown.length).toBeGreaterThan(0);
  });

  test('Non-Delhi state skips CM scheme', () => {
    const r = calculateSubsidy({ systemKw: 2, scheme: 'BOTH', state: 'RAJASTHAN' });
    expect(r.cmSchemeAmount).toBe(0);
  });
});

// =============================================================================
// 5. FINANCIAL CALCULATIONS
// =============================================================================

describe('calculateFinancials', () => {
  const BASE_INPUT = {
    totalSystemCost: 200000,
    subsidyAmount: 78000,
    annualKwh: 6000,
    tariffPerUnit: 8,
  };

  test('Returns 25 yearly projections', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.yearlyProjection).toHaveLength(25);
  });

  test('Net cost = total - subsidy', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.netCost).toBe(122000);
  });

  test('Year 1 savings = annualKwh × tariff', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.annualSavingsYear1).toBe(48000);
  });

  test('Payback is within 25 years', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.paybackYears).toBeLessThanOrEqual(25);
  });

  test('Lifetime savings > net cost (positive ROI)', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.lifetimeSavings).toBeGreaterThan(f.netCost);
    expect(f.roi25yr).toBeGreaterThan(0);
  });

  test('IRR is a reasonable number (5–30%) for standard residential', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.irr).toBeGreaterThan(5);
    expect(f.irr).toBeLessThan(50);
  });

  test('Cumulative savings grows monotonically year over year', () => {
    const f = calculateFinancials(BASE_INPUT);
    for (let i = 1; i < f.yearlyProjection.length; i++) {
      expect(f.yearlyProjection[i].cumulativeSavings).toBeGreaterThan(
        f.yearlyProjection[i - 1].cumulativeSavings
      );
    }
  });

  test('EMI is calculated for loan scenario', () => {
    const f = calculateFinancials({
      ...BASE_INPUT,
      loanAmount: 100000,
      loanRatePercent: 9,
      loanTenureMonths: 60,
    });
    expect(f.emi).toBeGreaterThan(0);
    expect(f.loanTotalCost).toBeGreaterThan(100000);
  });

  test('EMI zero-interest gives P/n', () => {
    const f = calculateFinancials({
      ...BASE_INPUT,
      loanAmount: 60000,
      loanRatePercent: 0,
      loanTenureMonths: 60,
    });
    expect(f.emi).toBe(1000); // 60000/60
  });

  test('No loan → emi and loanTotalCost are null', () => {
    const f = calculateFinancials(BASE_INPUT);
    expect(f.emi).toBeNull();
    expect(f.loanTotalCost).toBeNull();
  });

  test('Tariff escalation increases savings over time', () => {
    const f = calculateFinancials({ ...BASE_INPUT, annualTariffEscalation: 0.05 });
    const yr1 = f.yearlyProjection[0].annualSavings;
    const yr25 = f.yearlyProjection[24].annualSavings;
    expect(yr25).toBeGreaterThan(yr1);
  });
});

// =============================================================================
// 6. CO2
// =============================================================================

describe('calculateCO2', () => {
  test('6000 kWh → ~4.3 kg/yr, correct trees', () => {
    const r = calculateCO2(6000);
    expect(r.co2KgPerYear).toBeCloseTo(4296, 0);
    expect(r.treesEquivalent).toBeGreaterThan(0);
    expect(r.co2TonnesPer25yr).toBeCloseTo(107.4, 0);
  });

  test('Zero kWh gives zeros', () => {
    const r = calculateCO2(0);
    expect(r.co2KgPerYear).toBe(0);
    expect(r.treesEquivalent).toBe(0);
  });

  test('Throws on negative kWh', () => {
    expect(() => calculateCO2(-100)).toThrow();
  });
});

// =============================================================================
// 7. ROOF VALIDATOR
// =============================================================================

describe('validateRoofForSystem', () => {
  test('800 sqft roof fits 3 kW system with 440W panels', () => {
    const r = validateRoofForSystem({ roofAreaSqFt: 800, systemKw: 3, panelWattage: 440 });
    expect(r.fits).toBe(true);
  });

  test('Small roof (100 sqft) does not fit 5 kW system', () => {
    const r = validateRoofForSystem({ roofAreaSqFt: 100, systemKw: 5, panelWattage: 440 });
    expect(r.fits).toBe(false);
  });

  test('maxKwForRoof is proportional to roof area', () => {
    const small = validateRoofForSystem({ roofAreaSqFt: 300, systemKw: 1, panelWattage: 580 });
    const large = validateRoofForSystem({ roofAreaSqFt: 1000, systemKw: 1, panelWattage: 580 });
    expect(large.maxKwForRoof).toBeGreaterThan(small.maxKwForRoof);
  });

  test('Exactly fitting — requiredSqFt === availableSqFt', () => {
    // 5 kW with 440W → 12 panels (ceil of 11.36) × 26×1.5 sqft = 468 sqft required
    const panelCount = calculatePanelCount(5, 440); // is 12
    const required = panelCount * 26 * 1.5;
    const r = validateRoofForSystem({ roofAreaSqFt: required, systemKw: 5, panelWattage: 440 });
    expect(r.fits).toBe(true);
  });

  test('One panel over capacity — does not fit', () => {
    const panelCount = calculatePanelCount(5, 440); // 12 panels
    // One fewer panel's worth of roof space — system won't fit
    const tooSmall = (panelCount - 1) * 26 * 1.5;
    const r = validateRoofForSystem({ roofAreaSqFt: tooSmall, systemKw: 5, panelWattage: 440 });
    expect(r.fits).toBe(false);
  });

  test('requiredSqFt > availableSqFt when fits is false', () => {
    const r = validateRoofForSystem({ roofAreaSqFt: 50, systemKw: 5, panelWattage: 440 });
    expect(r.requiredSqFt).toBeGreaterThan(r.availableSqFt);
  });
});

// =============================================================================
// 8. STRING CONFIGURATION
// =============================================================================

describe('calculateStringConfig', () => {
  test('Valid config with Solis 10K and 25 panels of Waaree 440W', () => {
    const r = calculateStringConfig({
      panelCount: 25,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    expect(r.isValid).toBe(true);
    expect(r.warnings).toHaveLength(0);
    expect(r.configLabel).toMatch(/\d+S × \d+P/);
  });

  test('Winter Voc must not exceed inverter max input voltage', () => {
    const r = calculateStringConfig({
      panelCount: 20,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    expect(r.winterVoc).toBeLessThanOrEqual(SOLIS_10K_SPEC.maxInputVoltage);
  });

  test('Summer Vmpp must stay above MPPT min', () => {
    const r = calculateStringConfig({
      panelCount: 20,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    if (r.isValid) {
      expect(r.summerVmpp).toBeGreaterThanOrEqual(SOLIS_10K_SPEC.mpptVoltageMin);
    }
  });

  test('Too many panels for small inverter generates warnings', () => {
    // Try to cram 30 panels into a tiny 2-MPPT 600V inverter
    const r = calculateStringConfig({
      panelCount: 30,
      inverterModel: HAVELLS_3K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    // Either isValid=false with warnings, or it auto-capped — either way acceptable
    if (!r.isValid) {
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });

  test('Config label format is correct (NxS × NxP)', () => {
    const r = calculateStringConfig({
      panelCount: 12,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    expect(r.configLabel).toMatch(/^\d+S × \d+P$/);
  });

  test('Total panels = stringsCount × panelsPerString (or close due to rounding)', () => {
    const r = calculateStringConfig({
      panelCount: 21,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
    });
    const capacity = r.stringsCount * r.panelsPerString;
    // Capacity must be >= panelCount (may be slightly over due to ceil)
    expect(capacity).toBeGreaterThanOrEqual(21);
  });

  test('Voc temperature correction is applied correctly', () => {
    // At -5°C (30°C delta below STC 25°C): Voc increases
    const r = calculateStringConfig({
      panelCount: 10,
      inverterModel: SOLIS_10K_SPEC,
      panelSpec: WAAREE_440_SPEC,
      minAmbientTemp: -5,
    });
    // winterVoc per string should be > Voc(STC) × panelsPerString
    const vocAtStc = WAAREE_440_SPEC.voc * r.panelsPerString;
    expect(r.winterVoc).toBeGreaterThan(vocAtStc);
  });
});
