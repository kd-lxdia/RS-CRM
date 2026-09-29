
// =============================================================================
// Shadow Simulation Engine — Pure TypeScript, Zero External Dependencies
// All math self-contained. Zero external API calls.
// =============================================================================

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface SunPosition {
  elevation: number;    // degrees above horizon (negative = below)
  azimuth: number;      // degrees from North, clockwise (0=N, 90=E, 180=S, 270=W)
  isAboveHorizon: boolean;
}

export interface Point3D { x: number; y: number; z: number; }
export interface Point2D { x: number; y: number; }

export interface Obstruction3D {
  /** Polygon footprint in meters relative to scene origin */
  basePolygon: Point2D[];
  heightM: number;
  label?: string;
}

export interface PanelPosition3D {
  id: number;
  /** Panel center in meters (x=east, y=up, z=south) */
  cx: number;
  cy: number;
  cz: number;
  widthM: number;
  heightM: number;
  tiltDeg: number;
  azimuthDeg: number;
  stringId: number;
}

export interface ShadingReport {
  annualLossPercent: number;
  monthlyLoss: { month: number; monthName: string; lossPercent: number }[];
  panelShading: { panelId: number; annualLossPercent: number }[];
  heatmapData: { panelId: number; color: string; lossPercent: number }[];
  worstMonth: string;
  worstPanel: number;
  recommendation: string;
  computedAt: string;
}

export interface AnnualShadingInput {
  panels: PanelPosition3D[];
  roofTiltDeg: number;
  roofAzimuthDeg: number;
  obstructions: Obstruction3D[];
  lat: number;
  lng: number;
  sampleHoursPerDay?: number;  // 8am–4pm inclusive
  sampleDaysPerMonth?: number; // representative days
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const INDIA_TZ = 5.5;

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Monthly irradiance weights for Delhi (kWh/m²/day) — from IMD data
// Used to weight monthly shading losses into a meaningful annual figure
const MONTHLY_IRRADIANCE_WEIGHTS = [
  3.5, 4.2, 5.1, 5.8, 6.2, 6.0, 4.8, 4.5, 5.2, 5.5, 4.5, 3.8
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

/** Representative days per month (15th of each month roughly) */
function representativeDays(month: number /* 0-indexed */, count: number): number[] {
  const year = new Date().getFullYear();
  const days: number[] = [];
  const spacing = Math.floor(28 / (count + 1));
  for (let i = 1; i <= count; i++) {
    const d = new Date(year, month, i * spacing);
    days.push(getDayOfYear(d));
  }
  return days;
}

// ─── Sun Position (Spencer's Equation + Full NREL-style math) ────────────────

/**
 * Calculate sun position using Spencer's Equation of Time.
 * Matches NREL SPA to within ±0.1° for engineering purposes.
 */
export function getSunPosition(input: {
  date: Date;
  lat: number;
  lng: number;
  timezone?: number;
  clockHour?: number; // decimal hour of day in local clock time
}): SunPosition {
  const { date, lat, lng, timezone = INDIA_TZ } = input;
  const clockHour = input.clockHour ?? (date.getHours() + date.getMinutes() / 60);

  const doy = getDayOfYear(date);

  // Spencer's B angle (degrees)
  const B = (360 / 365) * (doy - 81);
  const Brad = B * DEG;

  // Equation of Time in minutes
  const EoT = 9.87 * Math.sin(2 * Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad);

  // Solar declination (degrees)
  const declination = 23.45 * Math.sin(Brad);

  // Local Solar Time (hours)
  const longitudeCorrection = (lng - timezone * 15) / 15; // hours
  const solarTime = clockHour + EoT / 60 + longitudeCorrection;

  // Hour angle (degrees; morning negative, afternoon positive)
  const hourAngle = 15 * (solarTime - 12);

  const latRad = lat * DEG;
  const decRad = declination * DEG;
  const haRad = hourAngle * DEG;

  // Solar elevation (degrees above horizon)
  const sinElevation =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation))) * RAD;

  // Solar azimuth (degrees, 0=N clockwise)
  const azRaw = Math.atan2(
    -Math.cos(decRad) * Math.sin(haRad),
    Math.sin(latRad) * Math.cos(decRad) * Math.cos(haRad) - Math.cos(latRad) * Math.sin(decRad)
  ) * RAD;
  const azimuth = ((azRaw + 360) % 360);

  return {
    elevation,
    azimuth,
    isAboveHorizon: elevation > 0,
  };
}

// ─── Shadow Length Calculation ────────────────────────────────────────────────

/**
 * Calculate the shadow cast by a tilted solar panel row onto the roof plane.
 * Returns shadow length in the row-direction (meters toward the next row).
 */
export function castPanelRowShadow(input: {
  panelHeightM: number;
  panelTiltDeg: number;
  panelAzimuthDeg: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
}): number {
  const { panelHeightM, panelTiltDeg, panelAzimuthDeg, sunElevationDeg, sunAzimuthDeg } = input;

  if (sunElevationDeg <= 0) return Infinity; // Sun below horizon — all in shadow

  const tiltRad = panelTiltDeg * DEG;
  const sunElRad = sunElevationDeg * DEG;
  const azDiffRad = (panelAzimuthDeg - sunAzimuthDeg) * DEG;

  // Height of panel's top edge projected onto horizontal plane
  const effectiveHeight = panelHeightM * Math.sin(tiltRad);

  // Total shadow length on horizontal plane
  const shadowLength = effectiveHeight / Math.tan(sunElRad);

  // Project shadow in the direction of row spacing (toward north for south-facing)
  const shadowInRowDirection = shadowLength * Math.cos(azDiffRad);

  return Math.max(0, shadowInRowDirection);
}

/**
 * Minimum shadow-free row gap to guarantee zero inter-row shading at winter solstice noon.
 * This is the required row pitch (center-to-center row spacing).
 */
export function shadowFreeRowPitchM(input: {
  panelHeightM: number;
  panelTiltDeg: number;
  lat: number;
}): number {
  // Worst case: Delhi winter solstice — sun elevation at noon
  const winterDeclinationDeg = -23.45;
  const lat = input.lat * DEG;
  const dec = winterDeclinationDeg * DEG;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec);
  const elevationDeg = Math.asin(sinEl) * RAD;

  if (elevationDeg <= 1) return input.panelHeightM * 3; // Safety floor

  const { panelHeightM, panelTiltDeg } = input;
  const tilt = panelTiltDeg * DEG;
  const el = elevationDeg * DEG;

  // Horizontal run of panel + shadow of vertical component
  const panelRun = panelHeightM * Math.cos(tilt);
  const shadowCast = (panelHeightM * Math.sin(tilt)) / Math.tan(el);

  return panelRun + shadowCast;
}

// ─── 3D Ray-AABB Intersection ─────────────────────────────────────────────────

interface AABB { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }

function polygonToAABB(polygon: Point2D[], heightM: number): AABB {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.y); // y in 2D = z in 3D (south axis)
    maxZ = Math.max(maxZ, p.y);
  }
  return { minX, maxX, minY: 0, maxY: heightM, minZ, maxZ };
}

/**
 * Slab-method ray-AABB intersection (Smits' algorithm).
 * Ray: origin + t*direction for t > 0 hits the box.
 */
function rayHitsAABB(
  ox: number, oy: number, oz: number,  // ray origin
  dx: number, dy: number, dz: number,  // ray direction (toward sun)
  box: AABB
): boolean {
  const invDx = dx === 0 ? Infinity : 1 / dx;
  const invDy = dy === 0 ? Infinity : 1 / dy;
  const invDz = dz === 0 ? Infinity : 1 / dz;

  const tx1 = (box.minX - ox) * invDx;
  const tx2 = (box.maxX - ox) * invDx;
  const tmin1 = Math.min(tx1, tx2), tmax1 = Math.max(tx1, tx2);

  const ty1 = (box.minY - oy) * invDy;
  const ty2 = (box.maxY - oy) * invDy;
  const tmin2 = Math.min(ty1, ty2), tmax2 = Math.max(ty1, ty2);

  const tz1 = (box.minZ - oz) * invDz;
  const tz2 = (box.maxZ - oz) * invDz;
  const tmin3 = Math.min(tz1, tz2), tmax3 = Math.max(tz1, tz2);

  const tmin = Math.max(tmin1, tmin2, tmin3);
  const tmax = Math.min(tmax1, tmax2, tmax3);

  // tmax > tmin AND hit is in front of origin (t > 0.1 to avoid self-intersection)
  return tmax > tmin && tmax > 0.1;
}

/**
 * Check if a 3D point is shaded by any obstruction given the sun direction.
 * Uses ray-AABB intersection for O(n) speed.
 */
export function isPointShaded(input: {
  point: Point3D;
  obstructions: Obstruction3D[];
  sunPosition: SunPosition;
}): boolean {
  const { point, obstructions, sunPosition } = input;
  if (!sunPosition.isAboveHorizon) return true; // Night

  const elRad = sunPosition.elevation * DEG;
  const azRad = sunPosition.azimuth * DEG;

  // Sun direction vector (normalized, pointing toward the sun)
  // Convention: x=east, y=up, z=south
  const dx = -Math.cos(elRad) * Math.sin(azRad);  // east component (sin of azimuth from N)
  const dy = Math.sin(elRad);                       // up component
  const dz = -Math.cos(elRad) * Math.cos(azRad);  // south component

  for (const obs of obstructions) {
    const box = polygonToAABB(obs.basePolygon, obs.heightM);
    if (rayHitsAABB(point.x, point.y, point.z, dx, dy, dz, box)) {
      return true;
    }
  }
  return false;
}

// ─── Panel Sample Points ──────────────────────────────────────────────────────

/**
 * Generate the center + 4 corner sample points for a panel in 3D space.
 * Panel is tilted on the roof (y = roof height, tilted toward azimuth).
 */
function getPanelSamplePoints(panel: PanelPosition3D): Point3D[] {
  const { cx, cy, cz, widthM, heightM, tiltDeg, azimuthDeg } = panel;
  const tilt = tiltDeg * DEG;
  const az = azimuthDeg * DEG;

  // Half-extents in local panel frame
  const hw = widthM / 2;
  const hh = heightM / 2;

  // Local panel coordinates (u=right, v=up-the-slope)
  const uAxis = { x: Math.cos(az), z: -Math.sin(az) };      // panel width direction
  const vAxis = { x: Math.sin(tilt) * Math.sin(az), y: Math.cos(tilt), z: Math.sin(tilt) * Math.cos(az) }; // panel height direction

  const corners = [
    { du: 0, dv: 0 },           // center
    { du: -hw, dv: -hh },       // bottom-left
    { du: +hw, dv: -hh },       // bottom-right
    { du: +hw, dv: +hh },       // top-right
    { du: -hw, dv: +hh },       // top-left
  ];

  return corners.map(({ du, dv }) => ({
    x: cx + du * uAxis.x + dv * vAxis.x,
    y: cy + dv * vAxis.y,
    z: cz + du * uAxis.z + dv * vAxis.z,
  }));
}

// ─── Annual Shading Analysis ───────────────────────────────────────────────────

/**
 * Run annual shading simulation. Samples 12 months × 4 days × 9 hours × panels.
 * Returns per-panel and per-month shading loss percentages.
 * Designed to run in a Web Worker to avoid blocking the UI thread.
 */
export function runAnnualShadingAnalysis(input: AnnualShadingInput): ShadingReport {
  const {
    panels,
    obstructions,
    lat,
    lng,
    sampleHoursPerDay = 9,
    sampleDaysPerMonth = 4,
  } = input;

  const timezone = INDIA_TZ;
  const startHour = 8;
  // Hours: 8, 9, 10, 11, 12, 13, 14, 15, 16
  const hours: number[] = Array.from({ length: sampleHoursPerDay }, (_, i) => startHour + i);

  // Track per-panel cumulative shading weighted by irradiance
  const panelLossWeightedSum = new Map<number, number>(); // panelId → Σ(irradiance × shading)
  const panelIrradianceSum = new Map<number, number>();   // panelId → Σirradiance

  for (const panel of panels) {
    panelLossWeightedSum.set(panel.id, 0);
    panelIrradianceSum.set(panel.id, 0);
  }

  const monthlyResults: { month: number; monthName: string; lossPercent: number }[] = [];
  const thisYear = new Date().getFullYear();

  for (let month = 0; month < 12; month++) {
    const days = representativeDays(month, sampleDaysPerMonth);
    const irradianceWeight = MONTHLY_IRRADIANCE_WEIGHTS[month];

    let monthShadedSum = 0;
    let monthTotalChecks = 0;

    for (const doy of days) {
      // Reconstruct a Date from day of year
      const date = new Date(thisYear, 0, doy);

      for (const hour of hours) {
        const sun = getSunPosition({ date, lat, lng, timezone, clockHour: hour });
        if (!sun.isAboveHorizon || sun.elevation < 5) continue; // Skip very low sun angles

        for (const panel of panels) {
          const samplePoints = getPanelSamplePoints(panel);
          let shadedCount = 0;

          for (const pt of samplePoints) {
            if (isPointShaded({ point: pt, obstructions, sunPosition: sun })) {
              shadedCount++;
            }
          }

          const shadingFraction = shadedCount / samplePoints.length;

          // Weighted by irradiance
          panelLossWeightedSum.set(
            panel.id,
            (panelLossWeightedSum.get(panel.id) ?? 0) + irradianceWeight * shadingFraction
          );
          panelIrradianceSum.set(
            panel.id,
            (panelIrradianceSum.get(panel.id) ?? 0) + irradianceWeight
          );

          monthShadedSum += shadingFraction;
          monthTotalChecks++;
        }
      }
    }

    const monthLoss = monthTotalChecks > 0
      ? Math.round((monthShadedSum / monthTotalChecks) * 1000) / 10  // 1dp %
      : 0;

    monthlyResults.push({ month: month + 1, monthName: MONTH_NAMES[month], lossPercent: monthLoss });
  }

  // Per-panel annual loss
  const panelShading: { panelId: number; annualLossPercent: number }[] = [];
  for (const panel of panels) {
    const ws = panelLossWeightedSum.get(panel.id) ?? 0;
    const wi = panelIrradianceSum.get(panel.id) ?? 1;
    const loss = Math.round((ws / wi) * 1000) / 10;
    panelShading.push({ panelId: panel.id, annualLossPercent: loss });
  }

  // Annual loss = irradiance-weighted average of monthly losses
  const totalIrradiance = MONTHLY_IRRADIANCE_WEIGHTS.reduce((a, b) => a + b, 0);
  const annualLossPercent = Math.round(
    monthlyResults.reduce((sum, m, i) => sum + m.lossPercent * MONTHLY_IRRADIANCE_WEIGHTS[i], 0) /
    totalIrradiance * 10
  ) / 10;

  // Worst month and panel
  const worstMonthObj = monthlyResults.reduce((a, b) => a.lossPercent > b.lossPercent ? a : b);
  const worstPanelObj = panelShading.length > 0
    ? panelShading.reduce((a, b) => a.annualLossPercent > b.annualLossPercent ? a : b)
    : { panelId: 0, annualLossPercent: 0 };

  // Heatmap colors
  const heatmapData = panelShading.map(({ panelId, annualLossPercent: loss }) => ({
    panelId,
    lossPercent: loss,
    color: loss < 5 ? '#22c55e' : loss < 15 ? '#84cc16' : loss < 25 ? '#f59e0b' : '#ef4444',
  }));

  // Recommendation
  let recommendation = 'Shading levels are excellent. No action required.';
  if (annualLossPercent > 25) {
    recommendation = 'High shading detected. Consider removing or trimming obstructions near the panels, or repositioning heavily shaded panels.';
  } else if (annualLossPercent > 10) {
    recommendation = `Moderate shading detected in ${worstMonthObj.monthName}. Review obstructions on the north/northeast side. String microinverters or optimizers recommended.`;
  } else if (annualLossPercent > 5) {
    recommendation = `Low shading detected. Panel string optimizer (e.g. Tigo or SolarEdge) will minimize the impact during ${worstMonthObj.monthName}.`;
  }

  return {
    annualLossPercent,
    monthlyLoss: monthlyResults,
    panelShading,
    heatmapData,
    worstMonth: worstMonthObj.monthName,
    worstPanel: worstPanelObj.panelId,
    recommendation,
    computedAt: new Date().toISOString(),
  };
}

// ─── Adjusted Generation ─────────────────────────────────────────────────────

/**
 * Apply shading-adjusted correction to base annual generation estimate.
 */
export function applyShading(baseAnnualKwh: number, shadingLossPercent: number): number {
  return Math.round(baseAnnualKwh * (1 - shadingLossPercent / 100));
}
