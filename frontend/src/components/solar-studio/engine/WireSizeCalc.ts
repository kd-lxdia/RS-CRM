// =============================================================================
// Wire Size Calculator
// =============================================================================

export interface WireSizeInput {
  stringVoltageVoc: number;    // V (Voc × modules per string)
  stringCurrentIsc: number;    // A
  wireLengthM: number;
  cableType: 'copper' | 'aluminium';
  allowableDropPercent?: number; // default 1%
}

export interface WireSizeResult {
  minCrossSectionMm2: number;
  recommendedSizeMm2: number;
  voltageDrop: number;
  voltageDropPercent: number;
}

const STANDARD_SIZES = [2.5, 4, 6, 10, 16, 25, 35, 50];

export function calculateWireSize(input: WireSizeInput): WireSizeResult {
  const { stringVoltageVoc, stringCurrentIsc, wireLengthM, cableType, allowableDropPercent = 1 } = input;

  // Resistivity (Ω·mm²/m)
  const rho = cableType === 'copper' ? 0.0175 : 0.028;

  // Allowable voltage drop (V)
  const deltaV = (allowableDropPercent / 100) * stringVoltageVoc;

  // Minimum cross-section area: A = (ρ × L × I) / ΔV
  // Using 2× length for round trip
  const minArea = (rho * 2 * wireLengthM * stringCurrentIsc) / deltaV;

  // Round up to nearest standard size
  const recommended = STANDARD_SIZES.find(s => s >= minArea) || STANDARD_SIZES[STANDARD_SIZES.length - 1];

  // Actual voltage drop with recommended size
  const actualDrop = (rho * 2 * wireLengthM * stringCurrentIsc) / recommended;
  const actualDropPercent = (actualDrop / stringVoltageVoc) * 100;

  return {
    minCrossSectionMm2: Math.round(minArea * 100) / 100,
    recommendedSizeMm2: recommended,
    voltageDrop: Math.round(actualDrop * 100) / 100,
    voltageDropPercent: Math.round(actualDropPercent * 100) / 100,
  };
}
