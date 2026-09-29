import pointInPolygonLib from 'point-in-polygon';
import { Client } from '@googlemaps/google-maps-services-js';

const googleMapsClient = new Client({});
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * Calculates the great-circle distance between two points on the Earth's surface using the Haversine formula.
 * @returns Distance in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRadians = (deg: number) => deg * (Math.PI / 180);
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a point is within a given radius (in meters) from a center coordinate.
 */
export function isWithinRadius(centerLat: number, centerLng: number, pointLat: number, pointLng: number, radiusMeters: number): boolean {
  return haversineDistance(centerLat, centerLng, pointLat, pointLng) <= radiusMeters;
}

/**
 * Checks if a point lies within a polygon defined by an array of coordinates.
 * Polygon coordinates should be an array of [longitude, latitude] or [latitude, longitude].
 * Note: Our coordinate system usually expects [longitude, latitude] for GeoJSON. 
 * We standardize here to accept [lat, lng] arrays for consistency with the function signature.
 */
export function pointInPolygon(lat: number, lng: number, polygonCoords: [number, number][]): boolean {
  // point-in-polygon requires the point and polygon points to be in the same format [x, y]
  return pointInPolygonLib([lat, lng], polygonCoords);
}

/**
 * Geocodes an address string to coordinates using Google Maps API.
 */
export async function getAddressCoordinates(address: string): Promise<{ lat: number; lng: number }> {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Google Maps API key is missing');
  
  const response = await googleMapsClient.geocode({
    params: {
      address,
      key: GOOGLE_MAPS_API_KEY,
    },
    timeout: 3000, // 3 secs
  });

  if (response.data.results.length === 0) {
    throw new Error('Address could not be geocoded');
  }

  const { lat, lng } = response.data.results[0].geometry.location;
  return { lat, lng };
}

/**
 * Reverse geocodes coordinates to a formatted address string using Google Maps API.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Google Maps API key is missing');

  const response = await googleMapsClient.reverseGeocode({
    params: {
      latlng: [lat, lng],
      key: GOOGLE_MAPS_API_KEY,
    },
    timeout: 3000,
  });

  if (response.data.results.length === 0) {
    throw new Error('Location could not be reverse geocoded');
  }

  return response.data.results[0].formatted_address;
}
