// =============================================================================
// GeoTIFF Utilities — Frontend
// =============================================================================
// Install: npm install geotiff

import { fromArrayBuffer } from 'geotiff';

export interface ParsedGeoTiff {
  width: number;
  height: number;
  bbox: number[]; // [west, south, east, north] in degrees
  bands: Float32Array[];
}

/**
 * Parse a GeoTIFF from an ArrayBuffer
 */
export async function parseGeoTiff(buffer: ArrayBuffer): Promise<ParsedGeoTiff> {
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [west, south, east, north]
  const rasters = await image.readRasters();

  return {
    width,
    height,
    bbox,
    bands: Array.from({ length: rasters.length }, (_, i) => 
      Float32Array.from(rasters[i] as any)
    ),
  };
}

/**
 * Sample a single pixel value at a given lat/lng
 */
export function sampleAtLatLng(
  data: Float32Array,
  width: number,
  height: number,
  bbox: number[],
  lat: number,
  lng: number
): number {
  const px = Math.round((lng - bbox[0]) / (bbox[2] - bbox[0]) * (width - 1));
  const py = Math.round((1 - (lat - bbox[1]) / (bbox[3] - bbox[1])) * (height - 1));
  
  const clampedPx = Math.min(Math.max(px, 0), width - 1);
  const clampedPy = Math.min(Math.max(py, 0), height - 1);
  
  const idx = clampedPy * width + clampedPx;
  return data[idx];
}

/**
 * Sample a rectangular region around a lat/lng point and return the average
 */
export function sampleRegion(
  data: Float32Array,
  width: number,
  height: number,
  bbox: number[],
  lat: number,
  lng: number,
  regionWidthM: number,
  regionHeightM: number
): number {
  // Calculate meters per pixel
  const mppX = ((bbox[2] - bbox[0]) * 111320 * Math.cos(lat * Math.PI / 180)) / width;
  const mppY = ((bbox[3] - bbox[1]) * 111320) / height;
  
  const halfW = Math.floor(regionWidthM / mppX / 2);
  const halfH = Math.floor(regionHeightM / mppY / 2);
  
  const cx = Math.round((lng - bbox[0]) / (bbox[2] - bbox[0]) * (width - 1));
  const cy = Math.round((1 - (lat - bbox[1]) / (bbox[3] - bbox[1])) * (height - 1));
  
  let sum = 0;
  let count = 0;
  
  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      
      if (px >= 0 && px < width && py >= 0 && py < height) {
        sum += data[py * width + px];
        count++;
      }
    }
  }
  
  return count > 0 ? sum / count : 0;
}

/**
 * Calculate meters per pixel at a given zoom level and latitude
 */
export function metersPerPixel(zoom: number, lat: number): number {
  return (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
}

/**
 * Convert lat/lng to pixel coordinates in a GeoTIFF
 */
export function latLngToPixel(
  lat: number,
  lng: number,
  bbox: number[],
  width: number,
  height: number
): { px: number; py: number } {
  const px = Math.round((lng - bbox[0]) / (bbox[2] - bbox[0]) * (width - 1));
  const py = Math.round((1 - (lat - bbox[1]) / (bbox[3] - bbox[1])) * (height - 1));
  
  return {
    px: Math.min(Math.max(px, 0), width - 1),
    py: Math.min(Math.max(py, 0), height - 1),
  };
}

/**
 * Convert pixel coordinates to lat/lng
 */
export function pixelToLatLng(
  px: number,
  py: number,
  bbox: number[],
  width: number,
  height: number
): { lat: number; lng: number } {
  const lng = bbox[0] + (px / (width - 1)) * (bbox[2] - bbox[0]);
  const lat = bbox[1] + ((1 - py / (height - 1)) * (bbox[3] - bbox[1]));
  
  return { lat, lng };
}

/**
 * Calculate solar access percentage from annual flux
 */
export function calculateSolarAccess(
  avgFlux: number,
  maxPossibleFlux: number
): number {
  return Math.min(100, (avgFlux / maxPossibleFlux) * 100);
}

/**
 * Get color code for solar access percentage
 */
export function getSolarAccessColor(solarAccessPct: number): string {
  if (solarAccessPct >= 95) return '#1a7d1a'; // dark green
  if (solarAccessPct >= 85) return '#5ab526'; // light green
  if (solarAccessPct >= 75) return '#c8d400'; // yellow-green
  if (solarAccessPct >= 65) return '#f0a500'; // amber
  if (solarAccessPct >= 50) return '#e05a00'; // orange
  return '#c02020'; // red
}

/**
 * Convert roof segment bounding box to canvas polygon vertices
 */
export function roofBoundingBoxToPolygon(
  boundingBox: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  },
  mapOriginLat: number,
  mapOriginLng: number,
  mpp: number,
  canvasScale: number
): number[] {
  const { sw, ne } = boundingBox;
  
  // Four corners: SW, SE, NE, NW
  const corners = [
    { lat: sw.latitude, lng: sw.longitude },
    { lat: sw.latitude, lng: ne.longitude },
    { lat: ne.latitude, lng: ne.longitude },
    { lat: ne.latitude, lng: sw.longitude },
  ];
  
  const vertices: number[] = [];
  
  for (const corner of corners) {
    const metersX = (corner.lng - mapOriginLng) * 111320 * Math.cos(mapOriginLat * Math.PI / 180);
    const metersY = (corner.lat - mapOriginLat) * 111320;
    
    const px = (metersX / mpp) * canvasScale;
    const py = (metersY / mpp) * canvasScale * -1; // y inverted
    vertices.push(px, py);
  }
  
  return vertices;
}

/**
 * Calculate energy yield for a module
 */
export function calculateModuleYield(
  moduleAreaM2: number,
  annualIrradianceKwhM2: number,
  moduleEfficiency: number,
  temperatureLoss = 0.035,
  soilingLoss = 0.02,
  wiringLoss = 0.02,
  mismatchLoss = 0.02
): number {
  const totalLoss = temperatureLoss + soilingLoss + wiringLoss + mismatchLoss;
  
  return (
    annualIrradianceKwhM2 *
    moduleAreaM2 *
    moduleEfficiency *
    (1 - totalLoss)
  );
}

/**
 * Calculate system-level AC output
 */
export function calculateSystemAcOutput(
  systemDcKwh: number,
  inverterEfficiency = 0.96
): number {
  return systemDcKwh * inverterEfficiency;
}

/**
 * Calculate specific yield (kWh/kWp)
 */
export function calculateSpecificYield(
  annualAcKwh: number,
  systemKwp: number
): number {
  return systemKwp > 0 ? annualAcKwh / systemKwp : 0;
}

/**
 * Calculate CO2 offset
 */
export function calculateCo2Offset(
  annualAcKwh: number,
  carbonOffsetFactorKgPerMwh: number
): number {
  return (annualAcKwh * carbonOffsetFactorKgPerMwh) / 1000;
}

/**
 * Calculate performance ratio
 */
export function calculatePerformanceRatio(
  annualAcKwh: number,
  systemKwp: number,
  maxSunshineHoursPerYear: number
): number {
  const theoreticalMax = systemKwp * maxSunshineHoursPerYear;
  return theoreticalMax > 0 ? annualAcKwh / theoreticalMax : 0;
}
