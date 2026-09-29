// =============================================================================
// Solar Studio Workflow Service — Complete Google Solar API Integration
// =============================================================================

import * as GoogleMapsService from './google-maps.service';
import * as GeoTiffUtils from '../utils/geotiff-utils';
import type { BuildingInsights, DataLayers } from './google-maps.service';
import type { ParsedGeoTiff } from '../utils/geotiff-utils';

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW STATE
// ═════════════════════════════════════════════════════════════════════════════

export interface SolarWorkflowState {
  // Step 1-2: Location
  address: string;
  lat: number;
  lng: number;
  
  // Step 4: Building Insights
  buildingInsights: BuildingInsights | null;
  
  // Step 5: Data Layers
  dataLayers: DataLayers | null;
  dsmData: ParsedGeoTiff | null;
  rgbData: ParsedGeoTiff | null;
  annualFluxData: ParsedGeoTiff | null;
  monthlyFluxData: ParsedGeoTiff[] | null;
  
  // Step 6: Elevation & Timezone
  elevation: number | null;
  timezone: {
    timeZoneId: string;
    rawOffset: number;
    dstOffset: number;
  } | null;
  
  // Processing status
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1-2: ADDRESS → COORDINATES
// ═════════════════════════════════════════════════════════════════════════════

export async function resolveAddress(placeId: string): Promise<{
  address: string;
  lat: number;
  lng: number;
}> {
  const result = await GoogleMapsService.geocode(placeId);
  
  return {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: FETCH BUILDING INSIGHTS
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchBuildingInsights(
  lat: number,
  lng: number
): Promise<BuildingInsights> {
  return await GoogleMapsService.buildingInsights(lat, lng);
}

/**
 * Convert roof segment bounding box to canvas polygon vertices
 */
export function roofSegmentToPolygon(
  segment: BuildingInsights['solarPotential']['roofSegmentStats'][0],
  mapOriginLat: number,
  mapOriginLng: number,
  mpp: number,
  canvasScale: number
): number[] {
  return GeoTiffUtils.roofBoundingBoxToPolygon(
    segment.boundingBox,
    mapOriginLat,
    mapOriginLng,
    mpp,
    canvasScale
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: FETCH DATA LAYERS (GeoTIFFs)
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchDataLayers(
  lat: number,
  lng: number,
  radiusMeters = 50,
  pixelSizeMeters = 0.5
): Promise<DataLayers> {
  return await GoogleMapsService.dataLayers(lat, lng, radiusMeters, pixelSizeMeters);
}

/**
 * Download and parse all GeoTIFF files
 */
export async function downloadAndParseGeoTiffs(
  dataLayers: DataLayers,
  onProgress?: (step: string, current: number, total: number) => void
): Promise<{
  dsm: ParsedGeoTiff;
  rgb: ParsedGeoTiff;
  annualFlux: ParsedGeoTiff;
  monthlyFlux: ParsedGeoTiff[];
}> {
  const total = 3 + dataLayers.monthlyFluxUrl.length;
  let current = 0;

  // Download DSM
  onProgress?.('Downloading DSM (elevation data)', ++current, total);
  const dsmBuffer = await GoogleMapsService.downloadGeoTiff(dataLayers.dsmUrl);
  const dsm = await GeoTiffUtils.parseGeoTiff(dsmBuffer);

  // Download RGB
  onProgress?.('Downloading RGB (aerial imagery)', ++current, total);
  const rgbBuffer = await GoogleMapsService.downloadGeoTiff(dataLayers.rgbUrl);
  const rgb = await GeoTiffUtils.parseGeoTiff(rgbBuffer);

  // Download Annual Flux
  onProgress?.('Downloading annual solar flux', ++current, total);
  const annualFluxBuffer = await GoogleMapsService.downloadGeoTiff(dataLayers.annualFluxUrl);
  const annualFlux = await GeoTiffUtils.parseGeoTiff(annualFluxBuffer);

  // Download Monthly Flux
  const monthlyFlux: ParsedGeoTiff[] = [];
  for (let i = 0; i < dataLayers.monthlyFluxUrl.length; i++) {
    onProgress?.(`Downloading monthly flux (${i + 1}/12)`, ++current, total);
    const buffer = await GoogleMapsService.downloadGeoTiff(dataLayers.monthlyFluxUrl[i]);
    const parsed = await GeoTiffUtils.parseGeoTiff(buffer);
    monthlyFlux.push(parsed);
  }

  return { dsm, rgb, annualFlux, monthlyFlux };
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6: FETCH ELEVATION & TIMEZONE
// ═════════════════════════════════════════════════════════════════════════════

export async function fetchElevationAndTimezone(lat: number, lng: number): Promise<{
  elevation: number;
  timezone: {
    timeZoneId: string;
    rawOffset: number;
    dstOffset: number;
  };
}> {
  const [elevationResult, timezoneResult] = await Promise.all([
    GoogleMapsService.elevation(lat, lng),
    GoogleMapsService.timezone(lat, lng),
  ]);

  return {
    elevation: elevationResult.elevation,
    timezone: {
      timeZoneId: timezoneResult.timeZoneId,
      rawOffset: timezoneResult.rawOffset,
      dstOffset: timezoneResult.dstOffset,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// SOLAR ACCESS CALCULATION
// ═════════════════════════════════════════════════════════════════════════════

export interface ModuleSolarData {
  moduleId: string;
  lat: number;
  lng: number;
  areaM2: number;
  annualFluxKwhM2: number;
  solarAccessPct: number;
  color: string;
  annualYieldKwh: number;
}

/**
 * Calculate solar access for all modules
 */
export function calculateModuleSolarAccess(
  modules: Array<{ id: string; lat: number; lng: number; widthM: number; lengthM: number; efficiency: number }>,
  annualFluxData: ParsedGeoTiff | null,
  maxSunshineHoursPerYear: number
): ModuleSolarData[] {
  const results: ModuleSolarData[] = [];

  for (const module of modules) {
    const areaM2 = module.widthM * module.lengthM;
    
    let annualFluxKwhM2 = 0;
    let solarAccessPct = 100;
    
    if (annualFluxData) {
      // Sample the annual flux at module location
      annualFluxKwhM2 = GeoTiffUtils.sampleRegion(
        annualFluxData.bands[0],
        annualFluxData.width,
        annualFluxData.height,
        annualFluxData.bbox,
        module.lat,
        module.lng,
        module.widthM,
        module.lengthM
      );

      // Calculate solar access percentage
      solarAccessPct = GeoTiffUtils.calculateSolarAccess(
        annualFluxKwhM2,
        maxSunshineHoursPerYear
      );
    } else {
      // Fallback manual estimate when Google Solar data is unavailable
      const effectiveSunshine = maxSunshineHoursPerYear || 1500;
      annualFluxKwhM2 = effectiveSunshine;
      solarAccessPct = 100; // Assume optimal placement in manual mode
    }

    // Get color code
    const color = GeoTiffUtils.getSolarAccessColor(solarAccessPct);

    // Calculate annual yield
    const annualYieldKwh = GeoTiffUtils.calculateModuleYield(
      areaM2,
      annualFluxKwhM2,
      module.efficiency
    );

    results.push({
      moduleId: module.id,
      lat: module.lat,
      lng: module.lng,
      areaM2,
      annualFluxKwhM2,
      solarAccessPct,
      color,
      annualYieldKwh,
    });
  }

  return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM-LEVEL CALCULATIONS
// ═════════════════════════════════════════════════════════════════════════════

export interface SystemSummary {
  totalModules: number;
  systemKwp: number;
  annualDcKwh: number;
  annualAcKwh: number;
  specificYield: number;
  co2OffsetKg: number;
  performanceRatio: number;
}

export function calculateSystemSummary(
  moduleSolarData: ModuleSolarData[],
  moduleWattage: number,
  carbonOffsetFactorKgPerMwh: number,
  maxSunshineHoursPerYear: number,
  inverterEfficiency = 0.96
): SystemSummary {
  const effectiveSunshineHours = maxSunshineHoursPerYear || 1500;
  const effectiveCarbonOffset = carbonOffsetFactorKgPerMwh || 400; // default 400 kg/MWh
  
  const totalModules = moduleSolarData.length;
  const systemKwp = (totalModules * moduleWattage) / 1000;
  const annualDcKwh = moduleSolarData.reduce((sum, m) => sum + m.annualYieldKwh, 0);
  const annualAcKwh = GeoTiffUtils.calculateSystemAcOutput(annualDcKwh, inverterEfficiency);
  const specificYield = GeoTiffUtils.calculateSpecificYield(annualAcKwh, systemKwp);
  const co2OffsetKg = GeoTiffUtils.calculateCo2Offset(annualAcKwh, effectiveCarbonOffset);
  const performanceRatio = GeoTiffUtils.calculatePerformanceRatio(
    annualAcKwh,
    systemKwp,
    effectiveSunshineHours
  );

  return {
    totalModules,
    systemKwp,
    annualDcKwh,
    annualAcKwh,
    specificYield,
    co2OffsetKg,
    performanceRatio,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETE WORKFLOW ORCHESTRATOR
// ═════════════════════════════════════════════════════════════════════════════

export async function runCompleteWorkflow(
  placeId: string,
  onProgress?: (step: string, progress: number) => void
): Promise<SolarWorkflowState> {
  try {
    // Step 1-2: Resolve address
    onProgress?.('Resolving address...', 10);
    const location = await resolveAddress(placeId);

    let buildingInsights = null;
    let dataLayers = null;
    let geoTiffs: { dsm: ParsedGeoTiff | null; rgb: ParsedGeoTiff | null; annualFlux: ParsedGeoTiff | null; monthlyFlux: ParsedGeoTiff[] | null } = { dsm: null, rgb: null, annualFlux: null, monthlyFlux: null };

    try {
      // Step 4: Fetch building insights
      onProgress?.('Fetching building insights...', 30);
      buildingInsights = await fetchBuildingInsights(location.lat, location.lng);

      // Step 5: Fetch data layers
      onProgress?.('Fetching solar data layers...', 50);
      dataLayers = await fetchDataLayers(location.lat, location.lng);

      // Download GeoTIFFs
      onProgress?.('Downloading GeoTIFF files...', 60);
      const downloadedGeoTiffs = await downloadAndParseGeoTiffs(dataLayers, (step, current, total) => {
        const progress = 60 + (current / total) * 20;
        onProgress?.(step, progress);
      });
      geoTiffs = {
        dsm: downloadedGeoTiffs.dsm,
        rgb: downloadedGeoTiffs.rgb,
        annualFlux: downloadedGeoTiffs.annualFlux,
        monthlyFlux: downloadedGeoTiffs.monthlyFlux,
      };
    } catch (apiError: any) {
      console.warn('Google Solar API data not available, falling back to manual mode.', apiError);
    }

    // Step 6: Fetch elevation & timezone
    onProgress?.('Fetching elevation and timezone...', 85);
    const { elevation, timezone } = await fetchElevationAndTimezone(location.lat, location.lng);

    onProgress?.('Complete!', 100);

    return {
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      buildingInsights,
      dataLayers,
      dsmData: geoTiffs.dsm,
      rgbData: geoTiffs.rgb,
      annualFluxData: geoTiffs.annualFlux,
      monthlyFluxData: geoTiffs.monthlyFlux,
      elevation,
      timezone,
      status: 'ready',
      error: !buildingInsights ? 'Solar data not available for this location. Manual mode enabled.' : null,
    };
  } catch (error: any) {
    console.error('Solar workflow error:', error);
    return {
      address: '',
      lat: 0,
      lng: 0,
      buildingInsights: null,
      dataLayers: null,
      dsmData: null,
      rgbData: null,
      annualFluxData: null,
      monthlyFluxData: null,
      elevation: null,
      timezone: null,
      status: 'error',
      error: error.message || 'Unknown error occurred',
    };
  }
}
