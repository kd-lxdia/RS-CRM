import { haversineDistance, isWithinRadius, pointInPolygon } from '../utils/geo';

describe('Geo Utility Functions', () => {
  describe('haversineDistance', () => {
    it('calculates distance accurately between two known points (Connaught Place to India Gate)', () => {
      // CP: 28.6304, 77.2177
      // India Gate: 28.6129, 77.2295
      const distance = haversineDistance(28.6304, 77.2177, 28.6129, 77.2295);
      // Rough distance is ~2.26km
      expect(distance).toBeGreaterThan(2200);
      expect(distance).toBeLessThan(2350);
    });

    it('returns 0 when points are identical', () => {
      expect(haversineDistance(28.6304, 77.2177, 28.6304, 77.2177)).toBe(0);
    });
  });

  describe('isWithinRadius', () => {
    it('returns true if point is inside radius', () => {
      // 500m radius check
      const isInside = isWithinRadius(28.6304, 77.2177, 28.6320, 77.2180, 500);
      expect(isInside).toBe(true);
    });

    it('returns false if point is outside radius', () => {
      // CP to India Gate is ~2.2km, so 1km radius should be false
      const isInside = isWithinRadius(28.6304, 77.2177, 28.6129, 77.2295, 1000);
      expect(isInside).toBe(false);
    });
  });

  describe('pointInPolygon', () => {
    // Delhi approximate bounding box (simplified rectangle for tests)
    const delhiBox: [number, number][] = [
      [28.84, 76.84], // NW
      [28.84, 77.34], // NE
      [28.40, 77.34], // SE
      [28.40, 76.84], // SW
    ];

    it('returns true for coordinates strictly inside polygon', () => {
      // CP is inside Delhi
      const inDelhi = pointInPolygon(28.63, 77.21, delhiBox);
      expect(inDelhi).toBe(true);
    });

    it('returns false for coordinates outside polygon', () => {
      // Mumbai coordinates
      const inDelhi = pointInPolygon(19.0760, 72.8777, delhiBox);
      expect(inDelhi).toBe(false);
    });
    
    it('handles complex concave shapes accurately', () => {
      const LShape: [number, number][] = [
        [0, 0], [0, 4], [2, 4], [2, 2], [4, 2], [4, 0]
      ];
      expect(pointInPolygon(1, 1, LShape)).toBe(true); // Inside bottom block
      expect(pointInPolygon(1, 3, LShape)).toBe(true); // Inside top block
      expect(pointInPolygon(3, 3, LShape)).toBe(false); // Outside the L corner
    });
  });
});
