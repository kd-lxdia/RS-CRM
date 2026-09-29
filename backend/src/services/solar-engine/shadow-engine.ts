
// =============================================================================
// Shadow Engine — Backend Port (identical math to frontend/src/utils/shadow-engine.ts)
// Pure TypeScript, no external deps. Used for server-side PDF generation.
// =============================================================================

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SunPosition {
  elevation: number;
  azimuth: number;
  isAboveHorizon: boolean;
}

export interface Point3D { x: number; y: number; z: number; }
export interface Point2D { x: number; y: number; }

export interface Obstruction3D {
  basePolygon: Point2D[];
  heightM: number;
  label?: string;
}

export interface PanelPosition3D {
  id: number;
  cx: number; cy: number; cz: number;
  widthM: number; heightM: number;
  tiltDeg: number; azimuthDeg: number;
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
  sampleHoursPerDay?: number;
  sampleDaysPerMonth?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const INDIA_TZ = 5.5;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHLY_IRRADIANCE = [3.5, 4.2, 5.1, 5.8, 6.2, 6.0, 4.8, 4.5, 5.2, 5.5, 4.5, 3.8];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function representativeDays(month: number, count: number): number[] {
  const year = new Date().getFullYear();
  const spacing = Math.floor(28 / (count + 1));
  return Array.from({ length: count }, (_, i) => getDayOfYear(new Date(year, month, (i + 1) * spacing)));
}

// ─── Sun Position ─────────────────────────────────────────────────────────────

export function getSunPosition(input: {
  date: Date; lat: number; lng: number; timezone?: number; clockHour?: number;
}): SunPosition {
  const { date, lat, lng, timezone = INDIA_TZ } = input;
  const clockHour = input.clockHour ?? (date.getHours() + date.getMinutes() / 60);
  const doy = getDayOfYear(date);

  const B = (360 / 365) * (doy - 81);
  const Brad = B * DEG;
  const EoT = 9.87 * Math.sin(2 * Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad);
  const declination = 23.45 * Math.sin(Brad);
  const solarTime = clockHour + EoT / 60 + (lng - timezone * 15) / 15;
  const hourAngle = 15 * (solarTime - 12);

  const latRad = lat * DEG, decRad = declination * DEG, haRad = hourAngle * DEG;
  const sinEl = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) * RAD;
  const azRaw = Math.atan2(
    -Math.cos(decRad) * Math.sin(haRad),
    Math.sin(latRad) * Math.cos(decRad) * Math.cos(haRad) - Math.cos(latRad) * Math.sin(decRad)
  ) * RAD;

  return { elevation, azimuth: ((azRaw + 360) % 360), isAboveHorizon: elevation > 0 };
}

// ─── Ray-AABB ────────────────────────────────────────────────────────────────

interface AABB { minX:number; maxX:number; minY:number; maxY:number; minZ:number; maxZ:number; }

function polygonToAABB(polygon: Point2D[], heightM: number): AABB {
  let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minZ) minZ = p.y; if (p.y > maxZ) maxZ = p.y;
  }
  return { minX, maxX, minY: 0, maxY: heightM, minZ, maxZ };
}

function rayHitsAABB(ox:number,oy:number,oz:number, dx:number,dy:number,dz:number, b:AABB): boolean {
  const ix = dx===0?Infinity:1/dx, iy = dy===0?Infinity:1/dy, iz = dz===0?Infinity:1/dz;
  const tx1=(b.minX-ox)*ix, tx2=(b.maxX-ox)*ix;
  const ty1=(b.minY-oy)*iy, ty2=(b.maxY-oy)*iy;
  const tz1=(b.minZ-oz)*iz, tz2=(b.maxZ-oz)*iz;
  const tmin = Math.max(Math.min(tx1,tx2), Math.min(ty1,ty2), Math.min(tz1,tz2));
  const tmax = Math.min(Math.max(tx1,tx2), Math.max(ty1,ty2), Math.max(tz1,tz2));
  return tmax > tmin && tmax > 0.1;
}

function isPointShaded(point: Point3D, obstructions: Obstruction3D[], sun: SunPosition): boolean {
  if (!sun.isAboveHorizon) return true;
  const el = sun.elevation * DEG, az = sun.azimuth * DEG;
  const dx = -Math.cos(el)*Math.sin(az), dy = Math.sin(el), dz = -Math.cos(el)*Math.cos(az);
  return obstructions.some(obs => rayHitsAABB(point.x, point.y, point.z, dx, dy, dz, polygonToAABB(obs.basePolygon, obs.heightM)));
}

function getPanelSamplePoints(panel: PanelPosition3D): Point3D[] {
  const { cx, cy, cz, widthM, heightM, tiltDeg, azimuthDeg } = panel;
  const tilt = tiltDeg * DEG, az = azimuthDeg * DEG;
  const hw = widthM / 2, hh = heightM / 2;
  const corners = [{du:0,dv:0},{du:-hw,dv:-hh},{du:hw,dv:-hh},{du:hw,dv:hh},{du:-hw,dv:hh}];
  return corners.map(({ du, dv }) => ({
    x: cx + du * Math.cos(az) + dv * Math.sin(tilt) * Math.sin(az),
    y: cy + dv * Math.cos(tilt),
    z: cz - du * Math.sin(az) + dv * Math.sin(tilt) * Math.cos(az),
  }));
}

// ─── Annual Analysis ─────────────────────────────────────────────────────────

export function runAnnualShadingAnalysis(input: AnnualShadingInput): ShadingReport {
  const { panels, obstructions, lat, lng, sampleHoursPerDay = 9, sampleDaysPerMonth = 4 } = input;
  const hours = Array.from({ length: sampleHoursPerDay }, (_, i) => 8 + i);

  const panelLoss = new Map<number, number>();
  const panelWeight = new Map<number, number>();
  for (const p of panels) { panelLoss.set(p.id, 0); panelWeight.set(p.id, 0); }

  const monthlyResults: { month: number; monthName: string; lossPercent: number }[] = [];
  const year = new Date().getFullYear();

  for (let month = 0; month < 12; month++) {
    const days = representativeDays(month, sampleDaysPerMonth);
    const irr = MONTHLY_IRRADIANCE[month];
    let shadedSum = 0, totalChecks = 0;

    for (const doy of days) {
      const date = new Date(year, 0, doy);
      for (const hour of hours) {
        const sun = getSunPosition({ date, lat, lng, clockHour: hour });
        if (!sun.isAboveHorizon || sun.elevation < 5) continue;

        for (const panel of panels) {
          const pts = getPanelSamplePoints(panel);
          const shadedCount = pts.filter(pt => isPointShaded(pt, obstructions, sun)).length;
          const frac = shadedCount / pts.length;
          panelLoss.set(panel.id, (panelLoss.get(panel.id) ?? 0) + irr * frac);
          panelWeight.set(panel.id, (panelWeight.get(panel.id) ?? 0) + irr);
          shadedSum += frac; totalChecks++;
        }
      }
    }

    monthlyResults.push({
      month: month + 1,
      monthName: MONTH_NAMES[month],
      lossPercent: totalChecks > 0 ? Math.round(shadedSum / totalChecks * 1000) / 10 : 0,
    });
  }

  const panelShading = panels.map(p => ({
    panelId: p.id,
    annualLossPercent: Math.round((panelLoss.get(p.id) ?? 0) / Math.max(1, panelWeight.get(p.id) ?? 1) * 1000) / 10,
  }));

  const totalIrr = MONTHLY_IRRADIANCE.reduce((a, b) => a + b, 0);
  const annualLossPercent = Math.round(
    monthlyResults.reduce((sum, m, i) => sum + m.lossPercent * MONTHLY_IRRADIANCE[i], 0) / totalIrr * 10) / 10;

  const worstMonthObj = monthlyResults.reduce((a, b) => a.lossPercent > b.lossPercent ? a : b);
  const worstPanelObj = panelShading.reduce((a, b) => a.annualLossPercent > b.annualLossPercent ? a : b, { panelId: 0, annualLossPercent: 0 });

  const heatmapData = panelShading.map(({ panelId, annualLossPercent: loss }) => ({
    panelId, lossPercent: loss,
    color: loss < 5 ? '#22c55e' : loss < 15 ? '#84cc16' : loss < 25 ? '#f59e0b' : '#ef4444',
  }));

  let recommendation = 'Shading levels are excellent. No action required.';
  if (annualLossPercent > 25) recommendation = 'High shading detected. Consider removing or trimming obstructions near the panels, or repositioning heavily shaded panels.';
  else if (annualLossPercent > 10) recommendation = `Moderate shading in ${worstMonthObj.monthName}. Review obstructions on the north/northeast side. String optimizers recommended.`;
  else if (annualLossPercent > 5) recommendation = `Low shading detected. A panel optimizer (Tigo or SolarEdge) will minimize the impact during ${worstMonthObj.monthName}.`;

  return {
    annualLossPercent, monthlyLoss: monthlyResults, panelShading, heatmapData,
    worstMonth: worstMonthObj.monthName, worstPanel: worstPanelObj.panelId,
    recommendation, computedAt: new Date().toISOString(),
  };
}
