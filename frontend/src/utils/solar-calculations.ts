// =============================================================================
// Solar Position & Shadow Calculations
// =============================================================================

import SunCalc from 'suncalc';

export interface SolarPosition {
  azimuth: number;      // degrees, 0=N clockwise
  elevation: number;    // degrees above horizon
  declination: number;  // degrees
  hourAngle: number;    // degrees
  isAboveHorizon: boolean;
}

export interface ShadowVector {
  dirX: number;
  dirY: number;
  length: number;
}

/**
 * Calculate solar position for a given date, time, and location
 */
export function calculateSolarPosition(
  lat: number,
  lng: number,
  day: number,
  month: number,
  hour: number,
  minute: number,
  timezoneOffsetMinutes: number,
  year: number = new Date().getFullYear()
): SolarPosition {
  const date = new Date(year, month - 1, day, hour, minute);
  const pos = SunCalc.getPosition(date, lat, lng);
  
  // SunCalc returns azimuth where 0 is South, positive is West.
  // We want 0=North, clockwise (standard compass).
  const azimuthN = (pos.azimuth * 180 / Math.PI + 180) % 360;
  const elevation = pos.altitude * 180 / Math.PI;

  return {
    azimuth: azimuthN,
    elevation,
    declination: 0, // Not provided directly, but usually not needed if using SunCalc
    hourAngle: 0,
    isAboveHorizon: elevation > 0,
  };
}

/**
 * Calculate shadow vector from solar position
 */
export function calculateShadowVector(
  solarPosition: SolarPosition,
  obstructionHeight: number,
  metersPerPixel: number
): ShadowVector {
  if (!solarPosition.isAboveHorizon || solarPosition.elevation <= 0) {
    return { dirX: 0, dirY: 0, length: 0 };
  }

  // Shadow length on ground
  const shadowLengthMeters = obstructionHeight / Math.tan(solarPosition.elevation * Math.PI / 180);
  const shadowLengthPixels = shadowLengthMeters / metersPerPixel;

  // Shadow direction (opposite to sun direction)
  const azimuthRad = solarPosition.azimuth * Math.PI / 180;
  const dirX = -Math.sin(azimuthRad);
  const dirY = Math.cos(azimuthRad);

  return {
    dirX,
    dirY,
    length: shadowLengthPixels,
  };
}

/**
 * Calculate shadow polygon for a cylindrical obstruction
 */
export function calculateCylinderShadow(
  centerX: number,
  centerY: number,
  radius: number,
  shadowVector: ShadowVector
): number[] {
  if (shadowVector.length === 0) return [];

  // Calculate perpendicular direction
  const perpX = -shadowVector.dirY;
  const perpY = shadowVector.dirX;

  // Four corners of shadow polygon
  const leftEdgeX = centerX + perpX * radius;
  const leftEdgeY = centerY + perpY * radius;
  const rightEdgeX = centerX - perpX * radius;
  const rightEdgeY = centerY - perpY * radius;

  const leftTipX = leftEdgeX + shadowVector.dirX * shadowVector.length;
  const leftTipY = leftEdgeY + shadowVector.dirY * shadowVector.length;
  const rightTipX = rightEdgeX + shadowVector.dirX * shadowVector.length;
  const rightTipY = rightEdgeY + shadowVector.dirY * shadowVector.length;

  return [
    leftEdgeX, leftEdgeY,
    leftTipX, leftTipY,
    rightTipX, rightTipY,
    rightEdgeX, rightEdgeY,
  ];
}

/**
 * Calculate shadow polygon for a rectangular/polygon obstruction
 */
export function calculatePolygonShadow(
  vertices: number[],
  height: number,
  shadowVector: ShadowVector
): number[] {
  if (shadowVector.length === 0) return [];

  const shadowPolygon: number[] = [];

  // Add original vertices
  for (let i = 0; i < vertices.length; i += 2) {
    shadowPolygon.push(vertices[i], vertices[i + 1]);
  }

  // Add projected vertices (in reverse order to maintain winding)
  for (let i = vertices.length - 2; i >= 0; i -= 2) {
    const projectedX = vertices[i] + shadowVector.dirX * shadowVector.length;
    const projectedY = vertices[i + 1] + shadowVector.dirY * shadowVector.length;
    shadowPolygon.push(projectedX, projectedY);
  }

  return shadowPolygon;
}

/**
 * Calculate shadow for a tree (circular crown)
 */
export function calculateTreeShadow(
  centerX: number,
  centerY: number,
  trunkHeight: number,
  crownRadius: number,
  crownHeight: number,
  shadowVector: ShadowVector,
  solarPosition: SolarPosition
): { centerX: number; centerY: number; radiusX: number; radiusY: number } {
  if (!solarPosition.isAboveHorizon) {
    return { centerX, centerY, radiusX: 0, radiusY: 0 };
  }

  // Crown center height
  const crownCenterZ = trunkHeight + crownHeight / 2;

  // Offset the crown center by its share of the full tree-height shadow.
  const totalHeight = Math.max(trunkHeight + crownHeight, 1);
  const centerRatio = crownCenterZ / totalHeight;
  const shadowCenterX = centerX + shadowVector.dirX * shadowVector.length * centerRatio;
  const shadowCenterY = centerY + shadowVector.dirY * shadowVector.length * centerRatio;

  // Shadow radius (elliptical projection)
  const elevationRad = solarPosition.elevation * Math.PI / 180;
  const radiusX = crownRadius + crownCenterZ / Math.tan(elevationRad) * 0.3;
  const radiusY = crownRadius;

  return {
    centerX: shadowCenterX,
    centerY: shadowCenterY,
    radiusX,
    radiusY,
  };
}
