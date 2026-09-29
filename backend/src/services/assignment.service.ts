import { prisma } from '../lib/clients';
import { pointInPolygon, haversineDistance } from '../utils/geo';
import { User, Zone } from '@prisma/client';

export async function assignSalesperson(leadLat: number, leadLng: number, dealerId?: string | null): Promise<User | null> {
  const baseWhere = dealerId ? { dealerId } : {};

  const allZones = await prisma.zone.findMany();
  
  // 1. Find which zone contains the lead
  let targetZone: Zone | null = null;
  for (const zone of allZones) {
    if (!zone.coordinates) continue;
    try {
      const coords = zone.coordinates as [number, number][];
      if (pointInPolygon(leadLat, leadLng, coords)) {
        targetZone = zone;
        break;
      }
    } catch(e) { /* ignore parse errors */ }
  }

  let candidates: User[] = [];

  // 2. Get active salespersons in that zone
  if (targetZone) {
    candidates = await prisma.user.findMany({
      where: { role: 'SALESPERSON', isActive: true, zoneId: targetZone.id, ...baseWhere },
    });
  }

  // 6. Expand to adjacent zones if no one found in targetZone
  if (candidates.length === 0 && targetZone && targetZone.coordinates) {
    const tzCoords = targetZone.coordinates as [number, number][];
    const tzSet = new Set(tzCoords.map(c => `${c[0]},${c[1]}`));
    
    const adjacentZoneIds: string[] = [];
    for (const zone of allZones) {
      if (zone.id === targetZone.id || !zone.coordinates) continue;
      const coords = zone.coordinates as [number, number][];
      // simplistic adjacency: sharing at least 1 exact vertex
      const sharesVertex = coords.some(c => tzSet.has(`${c[0]},${c[1]}`));
      if (sharesVertex) {
        adjacentZoneIds.push(zone.id);
      }
    }

    if (adjacentZoneIds.length > 0) {
      candidates = await prisma.user.findMany({
        where: { role: 'SALESPERSON', isActive: true, zoneId: { in: adjacentZoneIds }, ...baseWhere },
      });
    }
  }

  // 7. If still none, search across all zones (fallback)
  if (candidates.length === 0) {
    candidates = await prisma.user.findMany({
      where: { role: 'SALESPERSON', isActive: true, ...baseWhere },
    });
  }

  if (candidates.length === 0) {
    return null; // No active salespersons available to assign
  }

  // 3. For each salesperson, count their active leads and get their last location
  const candidateStats = await Promise.all(
    candidates.map(async (user) => {
      const activeLeadsCount = await prisma.lead.count({
        where: {
          assignedSalesperson: user.id,
          status: { notIn: ['WON', 'LOST'] }
        }
      });

      const lastLog = await prisma.attendanceLog.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      });

      const dist = lastLog && lastLog.lat && lastLog.lng 
        ? haversineDistance(lastLog.lat, lastLog.lng, leadLat, leadLng)
        : Infinity;

      return { user, activeLeadsCount, dist };
    })
  );

  // 4 & 5. Sort by active leads (asc), then tie-break by distance (asc)
  candidateStats.sort((a, b) => {
    if (a.activeLeadsCount !== b.activeLeadsCount) {
      return a.activeLeadsCount - b.activeLeadsCount;
    }
    return a.dist - b.dist; // Pick nearest if tied
  });

  const assignedUser = candidateStats[0].user;

  // 8. Log the assignment event
  await prisma.timelineEvent.create({
    data: {
      eventType: 'SYSTEM_ASSIGNMENT',
      description: `Assigned User ${assignedUser.name} due to load-balancing (Active Leads: ${candidateStats[0].activeLeadsCount}) and proximity. Target Zone: ${targetZone?.name || 'Fallback'}`,
      performedBy: assignedUser.id
    }
  });

  return assignedUser;
}
