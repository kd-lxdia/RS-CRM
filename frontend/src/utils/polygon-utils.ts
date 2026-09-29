// =============================================================================
// Polygon Intersection & Clipping Utilities
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

/**
 * Sutherland-Hodgman polygon clipping algorithm
 * Returns the intersection of subject polygon with clip polygon
 */
export function clipPolygon(subjectPoly: Point[], clipPoly: Point[]): Point[] {
  let output = [...subjectPoly];
  
  if (output.length === 0 || clipPoly.length === 0) return [];

  for (let i = 0; i < clipPoly.length; i++) {
    if (output.length === 0) return [];
    
    const input = output;
    output = [];
    
    const A = clipPoly[(i + clipPoly.length - 1) % clipPoly.length];
    const B = clipPoly[i];

    for (let j = 0; j < input.length; j++) {
      const P = input[(j + input.length - 1) % input.length];
      const Q = input[j];

      if (isInside(Q, A, B)) {
        if (!isInside(P, A, B)) {
          output.push(intersection(P, Q, A, B));
        }
        output.push(Q);
      } else if (isInside(P, A, B)) {
        output.push(intersection(P, Q, A, B));
      }
    }
  }

  return output;
}

/**
 * Check if point p is on the left side of line AB
 */
function isInside(p: Point, a: Point, b: Point): boolean {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
}

/**
 * Calculate intersection point of two line segments
 */
function intersection(p1: Point, p2: Point, p3: Point, p4: Point): Point {
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
  
  const cross = d1.x * d2.y - d1.y * d2.x;
  
  if (Math.abs(cross) < 1e-10) {
    // Lines are parallel
    return p1;
  }
  
  const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / cross;
  
  return {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
  };
}

/**
 * Calculate area of a polygon using shoelace formula
 */
export function polygonArea(poly: Point[]): number {
  if (poly.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Convert flat array of coordinates to Point array
 */
export function flatToPoints(flat: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

/**
 * Convert Point array to flat array of coordinates
 */
export function pointsToFlat(points: Point[]): number[] {
  const flat: number[] = [];
  for (const p of points) {
    flat.push(p.x, p.y);
  }
  return flat;
}

/**
 * Calculate shaded fraction of a module by shadow polygon
 */
export function calculateShadedFraction(
  moduleVertices: number[],
  shadowVertices: number[]
): number {
  if (shadowVertices.length === 0) return 0;
  
  const modulePoly = flatToPoints(moduleVertices);
  const shadowPoly = flatToPoints(shadowVertices);
  
  const moduleArea = polygonArea(modulePoly);
  if (moduleArea === 0) return 0;
  
  const intersection = clipPolygon(modulePoly, shadowPoly);
  const intersectionArea = polygonArea(intersection);
  
  return Math.min(1, intersectionArea / moduleArea);
}

/**
 * Check if a point is inside a polygon
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Get bounding box of a polygon
 */
export function getBoundingBox(vertices: number[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (let i = 0; i < vertices.length; i += 2) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
  }
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Interpolate color between two RGB colors
 */
export function interpolateColor(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  factor: number
): string {
  const r = Math.round(color1.r + (color2.r - color1.r) * factor);
  const g = Math.round(color1.g + (color2.g - color1.g) * factor);
  const b = Math.round(color1.b + (color2.b - color1.b) * factor);
  return `rgb(${r},${g},${b})`;
}
