// =============================================================================
// GeoTIFF Parsing Utility
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
  const mpp = (bbox[2] - bbox[0]) * 111320 / width;
  
  const halfW = Math.floor(regionWidthM / mpp / 2);
  const halfH = Math.floor(regionHeightM / mpp / 2);
  
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
