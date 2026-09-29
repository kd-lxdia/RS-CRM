// =============================================================================
// Google Maps API Service — Frontend wrapper for backend proxy
// =============================================================================

import { api } from '../lib/api';

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1 — ADDRESS AUTOCOMPLETE
// ═════════════════════════════════════════════════════════════════════════════
export interface PlacePrediction {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

export async function placesAutocomplete(input: string): Promise<PlacePrediction[]> {
  const response = await api.get('/google-maps/places/autocomplete', {
    params: { input },
  });
  return response.data.suggestions || [];
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2 — GEOCODING
// ═════════════════════════════════════════════════════════════════════════════
export interface GeocodeResult {
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export async function geocode(placeId?: string, address?: string): Promise<GeocodeResult> {
  const response = await api.get('/google-maps/geocode', {
    params: { placeId, address },
  });
  
  if (response.data.status !== 'OK' || !response.data.results?.[0]) {
    throw new Error(`Geocoding failed: ${response.data.status}`);
  }
  
  return response.data.results[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3 — MAP TILES SESSION
// ═════════════════════════════════════════════════════════════════════════════
export interface TileSession {
  session: string;
  expiry: string;
  tileWidth: number;
  tileHeight: number;
  imageFormat: string;
}

export async function createTileSession(): Promise<TileSession> {
  const response = await api.post(
    '/google-maps/tiles/session',
    {},
    {}
  );
  return response.data;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4 — SOLAR API: BUILDING INSIGHTS
// ═════════════════════════════════════════════════════════════════════════════
export interface RoofSegmentStat {
  pitchDegrees: number;
  azimuthDegrees: number;
  stats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
  };
  center: { latitude: number; longitude: number };
  boundingBox: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  planeHeightAtCenterMeters: number;
}

export interface SolarPanel {
  center: { latitude: number; longitude: number };
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

export interface SolarPanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  roofSegmentSummaries: Array<{
    pitchDegrees: number;
    azimuthDegrees: number;
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    segmentIndex: number;
  }>;
}

export interface BuildingInsights {
  name: string;
  center: { latitude: number; longitude: number };
  boundingBox: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  imageryDate: { year: number; month: number; day: number };
  imageryProcessedDate: { year: number; month: number; day: number };
  postalCode: string;
  administrativeArea: string;
  statisticalArea: string;
  regionCode: string;
  solarPotential: {
    maxArrayPanelsCount: number;
    maxArrayAreaMeters2: number;
    maxSunshineHoursPerYear: number;
    carbonOffsetFactorKgPerMwh: number;
    roofSegmentStats: RoofSegmentStat[];
    solarPanels: SolarPanel[];
    solarPanelConfigs: SolarPanelConfig[];
  };
}

export async function buildingInsights(lat: number, lng: number): Promise<BuildingInsights> {
  const response = await api.get('/google-maps/solar/building-insights', {
    params: { lat, lng },
  });
  return response.data;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5 — SOLAR API: DATA LAYERS
// ═════════════════════════════════════════════════════════════════════════════
export interface DataLayers {
  imageryDate: { year: number; month: number; day: number };
  imageryProcessedDate: { year: number; month: number; day: number };
  dsmUrl: string;
  rgbUrl: string;
  maskUrl: string;
  annualFluxUrl: string;
  monthlyFluxUrl: string[];
  hourlyShadeUrls: string[];
  imageryQuality: string;
}

export async function dataLayers(
  lat: number,
  lng: number,
  radiusMeters = 50,
  pixelSizeMeters = 0.5
): Promise<DataLayers> {
  const response = await api.get('/google-maps/solar/data-layers', {
    params: { lat, lng, radiusMeters, pixelSizeMeters },
  });
  return response.data;
}

export async function downloadGeoTiff(url: string): Promise<ArrayBuffer> {
  const response = await api.get('/google-maps/solar/geotiff', {
    params: { url },
    responseType: 'arraybuffer',
  });
  return response.data;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6 — ELEVATION & TIMEZONE
// ═════════════════════════════════════════════════════════════════════════════
export interface ElevationResult {
  elevation: number;
  location: { lat: number; lng: number };
  resolution: number;
}

export async function elevation(lat: number, lng: number): Promise<ElevationResult> {
  const response = await api.get('/google-maps/elevation', {
    params: { lat, lng },
  });
  
  if (response.data.status !== 'OK' || !response.data.results?.[0]) {
    throw new Error(`Elevation API failed: ${response.data.status}`);
  }
  
  return response.data.results[0];
}

export interface TimezoneResult {
  dstOffset: number;
  rawOffset: number;
  timeZoneId: string;
  timeZoneName: string;
}

export async function timezone(lat: number, lng: number, timestamp?: number): Promise<TimezoneResult> {
  const response = await api.get('/google-maps/timezone', {
    params: { lat, lng, timestamp },
  });
  
  if (response.data.status !== 'OK') {
    throw new Error(`Timezone API failed: ${response.data.status}`);
  }
  
  return response.data;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 7 — AERIAL VIEW
// ═════════════════════════════════════════════════════════════════════════════
export interface AerialView {
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  videoId?: string;
  uris?: {
    landscapeUri?: string;
    portraitUri?: string;
  };
}

export async function aerialViewLookup(address: string): Promise<AerialView> {
  const response = await api.post(
    '/google-maps/aerial-view/lookup',
    { address },
    {}
  );
  return response.data;
}
