// =============================================================================
// Geometry Utilities — Used across the solar design studio
// =============================================================================

import type { Point2D } from '../store/types';

const DEG = Math.PI / 180;

/** Shoelace formula for polygon area */
export function polygonArea(polygon: Point2D[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

/** Ray-casting point-in-polygon test */
export function pointInPolygon(pt: Point2D, polygon: Point2D[]): boolean {
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

/** Check if a rect is fully inside a polygon (checks corners, midpoints, and center for robustness) */
export function rectFullyInPolygon(cx: number, cy: number, hw: number, hh: number, polygon: Point2D[]): boolean {
  const points: Point2D[] = [
    { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh }, // top corners
    { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }, // bottom corners
    { x: cx, y: cy - hh }, { x: cx, y: cy + hh },           // top/bottom midpoints
    { x: cx - hw, y: cy }, { x: cx + hw, y: cy },           // left/right midpoints
    { x: cx, y: cy }                                        // center
  ];
  return points.every(p => pointInPolygon(p, polygon));
}

/** Check if any corner of a rect overlaps a polygon */
export function rectOverlapsPolygon(cx: number, cy: number, hw: number, hh: number, polygon: Point2D[]): boolean {
  const corners: Point2D[] = [
    { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
  ];
  return corners.some(c => pointInPolygon(c, polygon));
}

/** Inset polygon by offset (simplified edge-parallel shrink) */
export function insetPolygon(polygon: Point2D[], offsetM: number): Point2D[] {
  if (polygon.length < 3) return polygon;
  const n = polygon.length;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    const e1x = curr.x - prev.x, e1y = curr.y - prev.y;
    const e2x = next.x - curr.x, e2y = next.y - curr.y;
    const len1 = Math.hypot(e1x, e1y), len2 = Math.hypot(e2x, e2y);
    if (len1 === 0 || len2 === 0) { result.push({ ...curr }); continue; }

    const n1x = e1y / len1, n1y = -e1x / len1;
    const n2x = e2y / len2, n2y = -e2x / len2;

    const bx = n1x + n2x, by = n1y + n2y;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-6) { result.push({ x: curr.x + n1x * offsetM, y: curr.y + n1y * offsetM }); continue; }

    const dot = n1x * (bx / blen) + n1y * (by / blen);
    const scale = dot === 0 ? offsetM : offsetM / dot;
    result.push({ x: curr.x + (bx / blen) * scale, y: curr.y + (by / blen) * scale });
  }
  return result;
}

/** Inset polygon with per-edge setbacks (N, E, S, W mapped to edges) */
export function insetPolygonPerEdge(polygon: Point2D[], setbacks: { n: number; e: number; s: number; w: number }): Point2D[] {
  // Simple approach: use average setback for the general inset
  const avg = (setbacks.n + setbacks.e + setbacks.s + setbacks.w) / 4;
  return insetPolygon(polygon, avg);
}

/** Rotate a point by angle (radians) around origin */
export function rotatePoint(p: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** Reflect a point across a line defined by p1 and p2 */
export function reflectAcrossLine(point: Point2D, p1: Point2D, p2: Point2D): Point2D {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return point;

  const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;

  return {
    x: 2 * projX - point.x,
    y: 2 * projY - point.y,
  };
}

/** Euclidean distance between two points */
export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Get centroid of a polygon */
export function centroid(polygon: Point2D[]): Point2D {
  const n = polygon.length;
  if (n === 0) return { x: 0, y: 0 };
  return {
    x: polygon.reduce((s, p) => s + p.x, 0) / n,
    y: polygon.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** Get bounding box of a polygon */
export function boundingBox(polygon: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

/** Snap a value to nearest grid step */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Check if point is near another point (within threshold px) */
export function isNearPoint(a: Point2D, b: Point2D, threshold: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < threshold;
}

/** Get edges of a polygon as pairs */
export function getEdges(polygon: Point2D[]): [Point2D, Point2D][] {
  const edges: [Point2D, Point2D][] = [];
  for (let i = 0; i < polygon.length; i++) {
    edges.push([polygon[i], polygon[(i + 1) % polygon.length]]);
  }
  return edges;
}

/** Convert px to meters using scale */
export function pxToMeters(px: number, pxPerMeter: number): number {
  return px / pxPerMeter;
}

/** Convert meters to px using scale */
export function metersToPx(m: number, pxPerMeter: number): number {
  return m * pxPerMeter;
}

/** Shadow-free row spacing calculation */
export function shadowFreeRowSpacing(moduleLengthM: number, tiltDeg: number, latDeg: number): number {
  const dec = -23.45; // winter solstice declination
  const elevDeg = 90 - Math.abs(latDeg) - 23.45;
  const tilt = tiltDeg * DEG;
  const elev = elevDeg * DEG;
  if (Math.tan(elev) < 1e-6) return moduleLengthM * 2.0;
  const shadowLength = moduleLengthM * Math.cos(tilt) + moduleLengthM * Math.sin(tilt) / Math.tan(elev);
  return shadowLength;
}

/** Generate unique ID */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// =============================================================================
// GEO COORDINATE ARCHITECTURE (WGS84 <-> ENU)
// =============================================================================

const WGS84_A = 6378137.0; // Semi-major axis
const WGS84_B = 6356752.314245; // Semi-minor axis
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

/** Geodetic to Earth-Centered Earth-Fixed (ECEF) */
export function geodeticToEcef(lat: number, lon: number, h: number) {
  const latRad = lat * DEG;
  const lonRad = lon * DEG;
  const sinLat = Math.sin(latRad);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (N + h) * Math.cos(latRad) * Math.cos(lonRad);
  const y = (N + h) * Math.cos(latRad) * Math.sin(lonRad);
  const z = (N * (1 - WGS84_E2) + h) * sinLat;
  return { x, y, z };
}

/** ECEF to East-North-Up (ENU) relative to a reference origin */
export function ecefToEnu(x: number, y: number, z: number, lat0: number, lon0: number, h0: number) {
  const ref = geodeticToEcef(lat0, lon0, h0);
  const dx = x - ref.x;
  const dy = y - ref.y;
  const dz = z - ref.z;
  
  const latRad = lat0 * DEG;
  const lonRad = lon0 * DEG;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const e = -sinLon * dx + cosLon * dy;
  const n = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const u = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;
  
  return { x: e, y: n, z: u }; // Mapping ENU to 3D Scene: x=East, y=North, z=Up
}

/** ECEF to Geodetic */
export function ecefToGeodetic(x: number, y: number, z: number) {
  const ep2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
  const p = Math.sqrt(x * x + y * y);
  const th = Math.atan2(WGS84_A * z, WGS84_B * p);
  const lonRad = Math.atan2(y, x);
  const latRad = Math.atan2(z + ep2 * WGS84_B * Math.pow(Math.sin(th), 3), p - WGS84_E2 * WGS84_A * Math.pow(Math.cos(th), 3));
  const sinLat = Math.sin(latRad);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const h = p / Math.cos(latRad) - N;
  return { lat: latRad / DEG, lon: lonRad / DEG, h };
}

/** ENU to ECEF */
export function enuToEcef(e: number, n: number, u: number, lat0: number, lon0: number, h0: number) {
  const latRad = lat0 * DEG;
  const lonRad = lon0 * DEG;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const dx = -sinLon * e - sinLat * cosLon * n + cosLat * cosLon * u;
  const dy = cosLon * e - sinLat * sinLon * n + cosLat * sinLon * u;
  const dz = cosLat * n + sinLat * u;

  const ref = geodeticToEcef(lat0, lon0, h0);
  return { x: ref.x + dx, y: ref.y + dy, z: ref.z + dz };
}

/** WGS84 to Local ENU Coordinates */
export function wgs84ToEnu(lat: number, lon: number, h: number, lat0: number, lon0: number, h0: number) {
  const { x, y, z } = geodeticToEcef(lat, lon, h);
  return ecefToEnu(x, y, z, lat0, lon0, h0);
}

/** Local ENU Coordinates to WGS84 */
export function enuToWgs84(e: number, n: number, u: number, lat0: number, lon0: number, h0: number) {
  const { x, y, z } = enuToEcef(e, n, u, lat0, lon0, h0);
  return ecefToGeodetic(x, y, z);
}

/** Haversine formula for physical distance on Earth (meters) */
export function geodesicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return WGS84_A * c;
}

/** Get meters per pixel for Web Mercator at a given latitude and zoom level */
export function getMercatorMetersPerPixel(lat: number, zoom: number): number {
  return 156543.03392 * Math.cos(lat * DEG) / Math.pow(2, zoom);
}

