// =============================================================================
// Google Maps API Routes
// =============================================================================

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  placesAutocomplete,
  geocode,
  createTileSession,
  buildingInsights,
  dataLayers,
  downloadGeoTiff,
  elevation,
  timezone,
  aerialViewLookup,
} from '../controllers/google-maps.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// STEP 1 — Address autocomplete
router.get('/places/autocomplete', placesAutocomplete);

// STEP 2 — Geocoding
router.get('/geocode', geocode);

// STEP 3 — Map tiles session
router.post('/tiles/session', createTileSession);

// STEP 4 — Solar API: Building insights
router.get('/solar/building-insights', buildingInsights);

// STEP 5 — Solar API: Data layers (GeoTIFFs)
router.get('/solar/data-layers', dataLayers);
router.get('/solar/geotiff', downloadGeoTiff);

// STEP 6 — Elevation & Timezone
router.get('/elevation', elevation);
router.get('/timezone', timezone);

// STEP 7 — Aerial View (optional)
router.post('/aerial-view/lookup', aerialViewLookup);

export default router;
