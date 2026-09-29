
// =============================================================================
// Panel Layout Engine — Pure TypeScript, Zero UI Dependencies
// All geometry is in METERS relative to roof center
// =============================================================================

export interface Point { x: number; y: number; }

export interface PanelPosition {
  id: number;
  x: number;       // center x in meters
  y: number;       // center y in meters
  row: number;
  col: number;
  isShaded: boolean;
  shadingPercent: number;
  stringId: number;
}

export interface PanelLayoutResult {
  panels: PanelPosition[];
  count: number;
  coveredAreaSqM: number;
  coveredAreaSqFt: number;
  layoutEfficiency: number;   // panels_area / usable_roof_area
  roofAreaSqM: number;
}

export interface LayoutInput {
  roofPolygon: Point[];
  obstructions: Point[][];
  panelWidthM: number;          // e.g. 1.134 for 580W portrait
  panelHeightM: number;         // e.g. 2.278
  tiltDeg: number;
  azimuthDeg: number;
  rowSpacingMultiplier?: number; // default 1.5
  edgeSetbackM?: number;         // default 0.5
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  maxPanelsPerString?: number;   // default 14
}

const DEG = Math.PI / 180;
const SQ_FT_PER_SQ_M = 10.7639;
const DELHI_LAT = 28.6;
const WINTER_SOLSTICE_DECLINATION = -23.45;

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/** Shoelace formula for polygon area in m² */
export function shoelaceAreaM2(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

/** Convert lat/lng polygon to meters using equirectangular projection relative to a given center */
export function latlngToMeters(
  polygon: { lat: number; lng: number }[],
  center?: { lat: number; lng: number }
): Point[] {
  if (polygon.length === 0) return [];
  const centerLat = center ? center.lat : polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const centerLng = center ? center.lng : polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  const latM = 111320;
  const lngM = 111320 * Math.cos(centerLat * DEG);
  return polygon.map(p => ({
    x: (p.lng - centerLng) * lngM,
    y: (p.lat - centerLat) * latM,
  }));
}

/** Ray-casting point-in-polygon test */
export function pointInPolygon(pt: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Check if a rectangle (defined by center + half-extents) is fully inside polygon and not in obstructions */
function rectFullyInPolygon(cx: number, cy: number, hw: number, hh: number, polygon: Point[]): boolean {
  const corners: Point[] = [
    { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
  ];
  return corners.every(c => pointInPolygon(c, polygon));
}

function rectOverlapsPolygon(cx: number, cy: number, hw: number, hh: number, polygon: Point[]): boolean {
  const corners: Point[] = [
    { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
  ];
  return corners.some(c => pointInPolygon(c, polygon));
}

function insetPolygon(polygon: Point[], offsetM: number): Point[] {
  if (polygon.length < 3) return polygon;
  const n = polygon.length;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  const isCCW = area > 0;
  // Right-hand normal (dy, -dx) points INWARD if clockwise, OUTWARD if CCW.
  const effectiveOffset = isCCW ? -offsetM : offsetM;

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Edge vectors
    const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
    const e2x = next.x - curr.x, e2y = next.y - curr.y;
    const len1 = Math.hypot(e1x, e1y), len2 = Math.hypot(e2x, e2y);
    if (len1 === 0 || len2 === 0) { result.push({ ...curr }); continue; }

    // Right-hand normals
    const n1x = e1y / len1, n1y = -e1x / len1;
    const n2x = e2y / len2, n2y = -e2x / len2;

    // Bisector
    const bx = n1x + n2x, by = n1y + n2y;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-6) { result.push({ x: curr.x + n1x * effectiveOffset, y: curr.y + n1y * effectiveOffset }); continue; }

    // Scale bisector to get inset amount
    const dot = n1x * (bx / blen) + n1y * (by / blen);
    if (Math.abs(dot) < 1e-6) {
      result.push({ x: curr.x, y: curr.y });
      continue;
    }
    const scale = effectiveOffset / dot;
    result.push({ x: curr.x + (bx / blen) * scale, y: curr.y + (by / blen) * scale });
  }
  return result;
}

/** Rotate a point by angle (radians) */
function rotatePoint(p: Point, angle: number): Point {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

// ─── Solar Geometry ──────────────────────────────────────────────────────────

/** Calculate sun elevation angle in degrees for Delhi winter solstice noon */
export function winterSolsticeElevation(latDeg: number = DELHI_LAT): number {
  const dec = WINTER_SOLSTICE_DECLINATION;
  const lat = latDeg * DEG;
  const decRad = dec * DEG;
  // At solar noon, hour angle = 0
  const sinElev = Math.sin(lat) * Math.sin(decRad) + Math.cos(lat) * Math.cos(decRad);
  return Math.asin(sinElev) / DEG;
}

/** Calculate shadow-free row spacing between panel rows */
export function shadowFreeRowSpacingM(panelHeightM: number, tiltDeg: number): number {
  const elevDeg = winterSolsticeElevation();
  const tilt = tiltDeg * DEG;
  const elev = elevDeg * DEG;
  if (Math.tan(elev) < 1e-6) return panelHeightM * 2.0; // fallback
  const shadowLength = panelHeightM * Math.sin(tilt) / Math.tan(elev);
  return panelHeightM * Math.cos(tilt) + shadowLength;
}

// ─── Sun Position ────────────────────────────────────────────────────────────

export interface SunPosition {
  elevationDeg: number;
  azimuthDeg: number;
}

export function calculateSunPosition(date: Date, hourDecimal: number, latDeg: number = DELHI_LAT): SunPosition {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);

  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * DEG);
  const hourAngle = 15 * (hourDecimal - 12);

  const lat = latDeg * DEG;
  const dec = declination * DEG;
  const ha = hourAngle * DEG;

  const sinElev = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const elevRad = Math.asin(sinElev);

  const cosAz = (Math.sin(dec) - Math.sin(lat) * sinElev) / (Math.cos(lat) * Math.cos(elevRad));
  const azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));

  return {
    elevationDeg: elevRad / DEG,
    azimuthDeg: hourAngle < 0 ? azRad / DEG : 360 - azRad / DEG,
  };
}

// ─── Main Layout Generator ───────────────────────────────────────────────────

export function generatePanelLayout(input: LayoutInput): PanelLayoutResult {
  const {
    roofPolygon,
    obstructions,
    tiltDeg,
    azimuthDeg,
    rowSpacingMultiplier = 1.5,
    edgeSetbackM = 0.5,
    orientation = 'PORTRAIT',
    maxPanelsPerString = 14,
  } = input;

  let { panelWidthM, panelHeightM } = input;

  // Swap dimensions for landscape orientation
  if (orientation === 'LANDSCAPE') {
    [panelWidthM, panelHeightM] = [panelHeightM, panelWidthM];
  }

  const roofAreaSqM = shoelaceAreaM2(roofPolygon);

  // Step 1: Inset polygon for edge setback
  const insetPoly = insetPolygon(roofPolygon, edgeSetbackM);
  if (insetPoly.length < 3) {
    return { panels: [], count: 0, coveredAreaSqM: 0, coveredAreaSqFt: 0, layoutEfficiency: 0, roofAreaSqM };
  }

  // Step 2: Rotate coordinate system to align with azimuth (north = 0, south = 180)
  // Panels face azimuth, so we rotate grid to that direction
  const rotAngle = -(azimuthDeg - 180) * DEG; // rotate so south-facing is "up" in grid
  const rotatedPoly = insetPoly.map(p => rotatePoint(p, rotAngle));
  const rotatedObstructions = obstructions.map(obs => obs.map(p => rotatePoint(p, rotAngle)));

  // Step 3: Find bounding box of rotated polygon
  const xs = rotatedPoly.map(p => p.x);
  const ys = rotatedPoly.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Step 4: Calculate row spacing (with shadow clearance)
  const rowSpacing = Math.max(shadowFreeRowSpacingM(panelHeightM, tiltDeg), panelHeightM * rowSpacingMultiplier);
  const colSpacing = panelWidthM + 0.02; // ~2cm gap between columns

  // Step 5: Grid fill
  const panels: PanelPosition[] = [];
  let panelId = 0;
  let stringId = 0;
  let panelsInCurrentString = 0;

  const hw = panelWidthM / 2;
  const hh = panelHeightM / 2;

  let row = 0;
  for (let cy = minY + hh; cy + hh <= maxY; cy += rowSpacing) {
    let col = 0;
    for (let cx = minX + hw; cx + hw <= maxX; cx += colSpacing) {
      const rotatedCenter: Point = { x: cx, y: cy };

      // Check this panel fits inside roof polygon (in rotated frame)
      if (!rectFullyInPolygon(cx, cy, hw, hh, rotatedPoly)) {
        col++;
        continue;
      }

      // Check it doesn't overlap any obstruction
      const blocked = rotatedObstructions.some(obs =>
        rectOverlapsPolygon(cx, cy, hw, hh, obs)
      );
      if (blocked) {
        col++;
        continue;
      }

      // Assign to string
      if (panelsInCurrentString >= maxPanelsPerString) {
        stringId++;
        panelsInCurrentString = 0;
      }

      // Rotate center back to original frame
      const origCenter = rotatePoint(rotatedCenter, -rotAngle);

      panels.push({
        id: panelId++,
        x: origCenter.x,
        y: origCenter.y,
        row,
        col,
        isShaded: false,
        shadingPercent: 0,
        stringId,
      });

      panelsInCurrentString++;
      col++;
    }
    row++;
  }

  const panelAreaM2 = panelWidthM * panelHeightM;
  const coveredAreaSqM = panels.length * panelAreaM2;

  return {
    panels,
    count: panels.length,
    coveredAreaSqM,
    coveredAreaSqFt: coveredAreaSqM * SQ_FT_PER_SQ_M,
    layoutEfficiency: roofAreaSqM > 0 ? coveredAreaSqM / roofAreaSqM : 0,
    roofAreaSqM,
  };
}

/** Compute per-panel hourly shading percentage for Delhi, given date */
export function computeShadingAnalysis(
  panels: PanelPosition[],
  obstructions: Point[][],
  tiltDeg: number,
  date: Date = new Date()
): PanelPosition[] {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16]; // 8am–4pm
  const result = panels.map(p => ({ ...p }));

  for (const panel of result) {
    let shadedCount = 0;

    for (const hour of hours) {
      const sun = calculateSunPosition(date, hour);
      if (sun.elevationDeg <= 0) continue;

      // Project shadow from each obstruction
      const shadowLength = Math.tan((90 - sun.elevationDeg) * DEG);
      const shadowDir = { x: Math.sin(sun.azimuthDeg * DEG), y: Math.cos(sun.azimuthDeg * DEG) };

      for (const obs of obstructions) {
        // Simple shadow check: if panel is in the projected shadow cone of obstruction
        // Assume default obstruction height of 1.5 meters for realistic shadow casting (e.g. water tanks, AC units)
        const DEFAULT_OBS_HEIGHT = 1.5;
        const obsCenter = { x: obs.reduce((s, p) => s + p.x, 0) / obs.length, y: obs.reduce((s, p) => s + p.y, 0) / obs.length };
        const shadowTip = { x: obsCenter.x - shadowDir.x * shadowLength * DEFAULT_OBS_HEIGHT, y: obsCenter.y - shadowDir.y * shadowLength * DEFAULT_OBS_HEIGHT };
        const dx = panel.x - obsCenter.x, dy = panel.y - obsCenter.y;
        const shadowDx = shadowTip.x - obsCenter.x, shadowDy = shadowTip.y - obsCenter.y;
        const shadowLen = Math.hypot(shadowDx, shadowDy);
        if (shadowLen < 0.01) continue;
        const proj = (dx * shadowDx + dy * shadowDy) / (shadowLen * shadowLen);
        if (proj > 0 && proj < 1) {
          const perpDist = Math.abs(dx * shadowDy / shadowLen - dy * shadowDx / shadowLen);
          if (perpDist < 2.0) { shadedCount++; break; }
        }
      }
    }

    panel.shadingPercent = Math.round((shadedCount / hours.length) * 100);
    panel.isShaded = panel.shadingPercent > 10;
  }

  return result;
}
