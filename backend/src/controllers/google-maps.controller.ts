// =============================================================================
// Google Maps API Controller — Proxy for Places, Geocoding, Solar, etc.
// =============================================================================

import { Request, Response } from 'express';
import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY not set — Google Maps features will fail');
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1 — ADDRESS AUTOCOMPLETE (Places API New)
// ═════════════════════════════════════════════════════════════════════════════
export async function placesAutocomplete(req: Request, res: Response) {
  try {
    const { input } = req.query;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid input parameter' });
    }

    const response = await axios.post(
      'https://places.googleapis.com/v1/places:autocomplete',
      { input },
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'suggestions.placePrediction',
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Places autocomplete error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to fetch autocomplete suggestions' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2 — GEOCODING (Resolve placeId → lat/lng)
// ═════════════════════════════════════════════════════════════════════════════
export async function geocode(req: Request, res: Response) {
  try {
    const { placeId, address } = req.query;

    if (!placeId && !address) {
      return res.status(400).json({ error: 'Missing placeId or address parameter' });
    }

    const params: any = { key: GOOGLE_API_KEY };
    if (placeId) params.place_id = placeId;
    if (address) params.address = address;

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      { params }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Geocoding error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to geocode address' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3 — MAP TILES SESSION (for HD satellite imagery)
// ═════════════════════════════════════════════════════════════════════════════
export async function createTileSession(req: Request, res: Response) {
  try {
    const response = await axios.post(
      'https://tile.googleapis.com/v1/createSession',
      {
        mapType: 'satellite',
        language: 'en-US',
        region: 'US',
        imageFormat: 'png',
        scale: 'scaleFactor2x',
      },
      {
        params: { key: GOOGLE_API_KEY },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Tile session error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to create tile session' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4 — SOLAR API: BUILDING INSIGHTS
// ═════════════════════════════════════════════════════════════════════════════
export async function buildingInsights(req: Request, res: Response) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameter' });
    }

    const response = await axios.get(
      'https://solar.googleapis.com/v1/buildingInsights:findClosest',
      {
        params: {
          'location.latitude': lat,
          'location.longitude': lng,
          requiredQuality: 'HIGH',
          key: GOOGLE_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Building insights error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to fetch building insights' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5 — SOLAR API: DATA LAYERS (DSM, Flux, Shade GeoTIFFs)
// ═════════════════════════════════════════════════════════════════════════════
export async function dataLayers(req: Request, res: Response) {
  try {
    const { lat, lng, radiusMeters = 50, pixelSizeMeters = 0.5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameter' });
    }

    const response = await axios.get(
      'https://solar.googleapis.com/v1/dataLayers:get',
      {
        params: {
          'location.latitude': lat,
          'location.longitude': lng,
          radiusMeters,
          view: 'FULL_LAYERS',
          requiredQuality: 'HIGH',
          pixelSizeMeters,
          key: GOOGLE_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Data layers error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to fetch data layers' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DOWNLOAD GEOTIFF (proxy to avoid CORS issues)
// ═════════════════════════════════════════════════════════════════════════════
export async function downloadGeoTiff(req: Request, res: Response) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }

    // Append API key if not already present
    const fullUrl = url.includes('key=') ? url : `${url}&key=${GOOGLE_API_KEY}`;

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
    });

    res.set('Content-Type', 'image/tiff');
    res.send(Buffer.from(response.data));
  } catch (error: any) {
    console.error('GeoTIFF download error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: { message: 'Failed to download GeoTIFF' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6 — ELEVATION API
// ═════════════════════════════════════════════════════════════════════════════
export async function elevation(req: Request, res: Response) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameter' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/elevation/json',
      {
        params: {
          locations: `${lat},${lng}`,
          key: GOOGLE_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Elevation error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to fetch elevation' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6 — TIMEZONE API
// ═════════════════════════════════════════════════════════════════════════════
export async function timezone(req: Request, res: Response) {
  try {
    const { lat, lng, timestamp = Math.floor(Date.now() / 1000) } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameter' });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/timezone/json',
      {
        params: {
          location: `${lat},${lng}`,
          timestamp,
          key: GOOGLE_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Timezone error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to fetch timezone' },
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 7 — AERIAL VIEW API (optional premium feature)
// ═════════════════════════════════════════════════════════════════════════════
export async function aerialViewLookup(req: Request, res: Response) {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Missing address in request body' });
    }

    const response = await axios.post(
      'https://aerialview.googleapis.com/v1/videos:lookupVideo',
      { address },
      {
        params: { key: GOOGLE_API_KEY },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Aerial view error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: 'Failed to lookup aerial view' },
    });
  }
}
