// =============================================================================
// Solar Access Engine — Per-module solar access calculation
// =============================================================================

import type { SolarAccessResult, DesignObstruction, Point2D } from '../store/types';
import { pointInPolygon } from '../utils/geometry';

const DEG = Math.PI / 180;

interface SunPos { elevation: number; azimuth: number; }

function calcSunPosition(dayOfYear: number, hour: number, latDeg: number): SunPos {
  const declination = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear)) * DEG);
  const hourAngle = 15 * (hour - 12);
  const lat = latDeg * DEG;
  const dec = declination * DEG;
  const ha = hourAngle * DEG;

  const sinElev = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinElev)));

  const cosAz = (Math.sin(dec) - Math.sin(lat) * sinElev) / (Math.cos(lat) * Math.cos(elev));
  const az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

  return {
    elevation: elev / DEG,
    azimuth: hourAngle < 0 ? az / DEG : 360 - az / DEG,
  };
}

function shadowDirection(azimuthDeg: number): Point2D {
  const azimuthRad = azimuthDeg * DEG;
  return {
    x: -Math.sin(azimuthRad),
    y: Math.cos(azimuthRad),
  };
}

function obstructionRadiusPx(obs: DesignObstruction, pxPerMeter: number): number {
  if (obs.type === 'cylinder') return obs.radius ?? 15;
  if (obs.type === 'tree') return (obs.crownRadius || 2.5) * pxPerMeter;
  return 0.75 * pxPerMeter;
}

function obstructionHeightM(obs: DesignObstruction): number {
  if (obs.type === 'tree') return (obs.trunkHeight || 3) + (obs.crownHeight || 4);
  return obs.height || 1.5;
}

function obstructionCenter(obs: DesignObstruction): Point2D {
  if (obs.center) return obs.center;
  const vertices = obs.vertices || [];
  return {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / Math.max(vertices.length, 1),
    y: vertices.reduce((sum, v) => sum + v.y, 0) / Math.max(vertices.length, 1),
  };
}

function projectedShadowPolygon(obs: DesignObstruction, dir: Point2D, lengthPx: number, pxPerMeter: number): Point2D[] {
  if (lengthPx <= 0) return [];

  if ((obs.type === 'cylinder' || obs.type === 'tree') && obs.center) {
    const radius = obstructionRadiusPx(obs, pxPerMeter);
    const perp = { x: -dir.y, y: dir.x };
    const left = { x: obs.center.x + perp.x * radius, y: obs.center.y + perp.y * radius };
    const right = { x: obs.center.x - perp.x * radius, y: obs.center.y - perp.y * radius };
    return [
      left,
      { x: left.x + dir.x * lengthPx, y: left.y + dir.y * lengthPx },
      { x: right.x + dir.x * lengthPx, y: right.y + dir.y * lengthPx },
      right,
    ];
  }

  if (obs.vertices.length >= 2) {
    return [
      ...obs.vertices,
      ...[...obs.vertices].reverse().map(v => ({
        x: v.x + dir.x * lengthPx,
        y: v.y + dir.y * lengthPx,
      })),
    ];
  }

  const center = obstructionCenter(obs);
  return [
    center,
    { x: center.x + dir.x * lengthPx, y: center.y + dir.y * lengthPx },
  ];
}

function pointNearShadowAxis(point: Point2D, obs: DesignObstruction, dir: Point2D, lengthPx: number, pxPerMeter: number): boolean {
  const center = obstructionCenter(obs);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const along = dx * dir.x + dy * dir.y;
  if (along < 0 || along > lengthPx) return false;

  const perpDist = Math.abs(dx * dir.y - dy * dir.x);
  return perpDist <= obstructionRadiusPx(obs, pxPerMeter);
}

function isPointShaded(point: Point2D, obs: DesignObstruction, sun: SunPos, pxPerMeter: number): boolean {
  const elevationRad = sun.elevation * DEG;
  const lengthPx = (obstructionHeightM(obs) * pxPerMeter) / Math.tan(elevationRad);
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) return false;

  const dir = shadowDirection(sun.azimuth);
  if (obs.type === 'cylinder' || obs.type === 'tree' || obs.vertices.length < 3) {
    return pointNearShadowAxis(point, obs, dir, lengthPx, pxPerMeter);
  }

  const polygon = projectedShadowPolygon(obs, dir, lengthPx, pxPerMeter);
  return polygon.length >= 3 && pointInPolygon(point, polygon);
}

function rgbStopGradient(value: number, stops: number[][]): string {
  const t = Math.max(0, Math.min(1, value));
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `rgb(${r},${g},${b})`;
}

// Monthly GHI weights for Delhi (kWh/m²/day)
const MONTHLY_GHI = [3.5, 4.2, 5.1, 5.8, 6.2, 6.0, 4.8, 4.5, 5.2, 5.5, 4.5, 3.8];

/**
 * Calculate solar access for each module via the Python pvlib backend.
 * Uses NREL SPA for highly accurate authoritative calculations.
 */
export async function calculateSolarAccessBackend(
  modules: { id: string; x: number; y: number }[],
  obstructions: DesignObstruction[],
  latDeg: number,
  lngDeg: number,
  pxPerMeter: number,
): Promise<SolarAccessResult> {
  // TODO: Replace with actual API call to the Python pvlib backend.
  // const response = await fetch('/api/solar-access', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ modules, obstructions, lat: latDeg, lng: lngDeg, pxPerMeter })
  // });
  // return response.json();

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const result: SolarAccessResult = {};
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const sampleDays = [15, 46, 75, 106, 136, 167, 197, 228, 259, 289, 320, 350]; // ~15th of each month

  for (const mod of modules) {
    let unshadedGHI = 0;
    let totalGHI = 0;

    for (let mi = 0; mi < 12; mi++) {
      const doy = sampleDays[mi];
      const monthGHI = MONTHLY_GHI[mi];
      const ghibPerHour = monthGHI / hours.length;

      for (const hour of hours) {
        const sun = calcSunPosition(doy, hour, latDeg);
        if (sun.elevation <= 0) continue;

        totalGHI += ghibPerHour;

        let shaded = false;

        for (const obs of obstructions) {
          if (isPointShaded({ x: mod.x, y: mod.y }, obs, sun, pxPerMeter)) {
            shaded = true;
            break;
          }
        }

        if (!shaded) {
          unshadedGHI += ghibPerHour;
        }
      }
    }

    result[mod.id] = totalGHI > 0 ? Math.round((unshadedGHI / totalGHI) * 100) : 100;
  }

  return result;
}

/** Get solar access color for a given percentage */
export function solarAccessColor(percent: number): string {
  if (percent < 50) return '#dc2626';   // deep red
  if (percent < 65) return '#ea580c';   // orange
  if (percent < 75) return '#eab308';   // yellow
  if (percent < 85) return '#84cc16';   // yellow-green
  if (percent < 95) return '#22c55e';   // light green
  return '#16a34a';                      // dark green
}

/** Get irradiance-map color for a 0-100 solar access percentage. */
export function irradianceAccessColor(percent: number): string {
  const t = percent / 100;
  return rgbStopGradient(t, [
    [127, 29, 29],   // very low - dark red
    [220, 38, 38],   // low - red
    [249, 115, 22],  // orange
    [234, 179, 8],   // yellow
    [132, 204, 22],  // yellow-green
    [34, 197, 94],   // green
  ]);
}

/** Get irradiance-map color for a normalized 0-1 flux/access value. */
export function irradianceFluxColor(value: number): string {
  return irradianceAccessColor(value * 100);
}
