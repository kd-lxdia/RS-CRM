// =============================================================================
// Irradiance Color Mapping (matching Arka360 style)
// =============================================================================

interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

// 5-stop colormap: red → orange → yellow → yellow-green → green
const COLOR_STOPS: ColorStop[] = [
  { t: 0.00, r: 180, g:  30, b:  20 },  // deep red
  { t: 0.25, r: 220, g: 100, b:  20 },  // orange
  { t: 0.50, r: 230, g: 200, b:  30 },  // yellow
  { t: 0.75, r: 160, g: 210, b:  40 },  // yellow-green
  { t: 1.00, r:  30, g: 150, b:  40 },  // green
];

/**
 * Get irradiance color for a normalized value (0.0 = worst, 1.0 = best)
 */
export function irradianceColor(normalized: number): string {
  // Clamp to [0, 1]
  normalized = Math.max(0, Math.min(1, normalized));

  // Find which two stops to interpolate between
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (normalized >= COLOR_STOPS[i].t && normalized <= COLOR_STOPS[i + 1].t) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }

  // Interpolate
  const range = hi.t - lo.t;
  const f = range > 0 ? (normalized - lo.t) / range : 0;

  const r = Math.round(lo.r + f * (hi.r - lo.r));
  const g = Math.round(lo.g + f * (hi.g - lo.g));
  const b = Math.round(lo.b + f * (hi.b - lo.b));

  return `rgb(${r},${g},${b})`;
}

/**
 * Get display value for legend (0.7 to 1.0 scale)
 */
export function getDisplayValue(normalized: number): number {
  return 0.7 + normalized * 0.3;
}

/**
 * Normalize flux values to 0-1 range
 */
export function normalizeFluxValues(fluxValues: number[]): number[] {
  if (fluxValues.length === 0) return [];

  const maxFlux = Math.max(...fluxValues);
  const minFlux = Math.min(...fluxValues);
  const range = maxFlux - minFlux;

  if (range === 0) return fluxValues.map(() => 1);

  return fluxValues.map(flux => (flux - minFlux) / range);
}

/**
 * Generate legend gradient CSS
 */
export function getLegendGradient(): string {
  const stops = COLOR_STOPS.map(stop => 
    `rgb(${stop.r},${stop.g},${stop.b}) ${stop.t * 100}%`
  ).join(', ');

  return `linear-gradient(to right, ${stops})`;
}

/**
 * Get legend tick values (0.7, 0.76, 0.82, 0.88, 0.94, 1.0)
 */
export function getLegendTicks(): number[] {
  return [0.7, 0.76, 0.82, 0.88, 0.94, 1.0];
}

/**
 * Get color for shaded module based on shaded fraction
 */
export function getShadedModuleColor(shadedFraction: number): string {
  if (shadedFraction === 0) {
    return '#1a3a6b'; // dark blue (normal)
  } else if (shadedFraction <= 0.5) {
    // Interpolate from dark blue to gray
    const f = shadedFraction / 0.5;
    const r = Math.round(26 + (74 - 26) * f);
    const g = Math.round(58 + (74 - 58) * f);
    const b = Math.round(107 + (74 - 107) * f);
    return `rgb(${r},${g},${b})`;
  } else {
    // Heavily shaded
    return '#2a2a2a'; // near-black
  }
}
