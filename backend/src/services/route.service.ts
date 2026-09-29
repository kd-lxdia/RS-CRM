import { Visit } from '@prisma/client';
import { haversineDistance } from '../utils/geo';

export function optimizeRoute(visits: Visit[]): Visit[] {
  if (!visits || visits.length <= 1) return visits;

  const optimized: Visit[] = [];
  
  // Greedy nearest-neighbor starting with the first scheduled visit chronologically
  const remaining = [...visits].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  
  let current = remaining.shift()!;
  optimized.push(current);

  while (remaining.length > 0) {
    if (!current.lat || !current.lng) {
      // If no valid coordinates on current point, just pick the next chronological one
      current = remaining.shift()!;
      optimized.push(current);
      continue;
    }

    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const target = remaining[i];
      if (!target.lat || !target.lng) continue; // Skip if target lacks coordinates

      const dist = haversineDistance(current.lat, current.lng, target.lat, target.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    // fallback to first item if nearest algorithm bypassed everything (i.e. all targets lack coordinates)
    if (minDistance === Infinity) {
      nearestIndex = 0;
    }

    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  return optimized;
}

export function calculateTotalDistance(optimizedVisits: Visit[]): number {
  let totalMeters = 0;
  for (let i = 0; i < optimizedVisits.length - 1; i++) {
    const cur = optimizedVisits[i];
    const next = optimizedVisits[i + 1];
    if (cur.lat && cur.lng && next.lat && next.lng) {
      totalMeters += haversineDistance(cur.lat, cur.lng, next.lat, next.lng);
    }
  }
  return totalMeters / 1000; // convert to km
}
