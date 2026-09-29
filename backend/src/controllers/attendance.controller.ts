import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

// Haversine formula to calculate distance between two lat/lng points in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const markAttendance = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const todayString = dayjs().format('YYYY-MM-DD');

    // Check if already marked for today
    const existing = await prisma.dailyAttendance.findUnique({
      where: { userId_date: { userId, date: todayString } }
    });

    if (existing && existing.status === 'PRESENT') {
      return res.json({ success: true, message: 'Attendance already marked for today', data: existing });
    }

    // 1. Get Office Location
    let officeLat = 28.7041; // Default fallback
    let officeLng = 77.1025; // Default fallback

    const latSetting = await prisma.systemSetting.findUnique({ where: { key: 'OFFICE_LAT' } });
    const lngSetting = await prisma.systemSetting.findUnique({ where: { key: 'OFFICE_LNG' } });

    if (latSetting && !isNaN(parseFloat(latSetting.value))) officeLat = parseFloat(latSetting.value);
    if (lngSetting && !isNaN(parseFloat(lngSetting.value))) officeLng = parseFloat(lngSetting.value);

    let locationType = '';
    let distanceToOffice = getDistanceInMeters(lat, lng, officeLat, officeLng);

    if (distanceToOffice <= 200) {
      locationType = 'OFFICE';
    } else {
      // 2. Check Sites if not near office
      // User requested Salesperson AND Installation to be able to mark at sites.
      if (['SALESPERSON', 'INSTALLATION', 'DOCUMENTATION'].includes(userRole)) {
        // Find visits scheduled for today for this user
        const startOfDay = dayjs().startOf('day').toDate();
        const endOfDay = dayjs().endOf('day').toDate();

        const todayVisits = await prisma.visit.findMany({
          where: {
            assignedTo: userId,
            scheduledAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        });

        for (const visit of todayVisits) {
          if (visit.lat && visit.lng) {
            const dist = getDistanceInMeters(lat, lng, visit.lat, visit.lng);
            if (dist <= 200) {
              locationType = 'SITE';
              break;
            }
          }
        }
      }
    }

    if (!locationType) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not within 200 meters of the office or any scheduled site.' 
      });
    }

    // Mark present
    const attendance = await prisma.dailyAttendance.upsert({
      where: { userId_date: { userId, date: todayString } },
      update: {
        status: 'PRESENT',
        checkInAt: new Date(),
        lat,
        lng,
        locationType
      },
      create: {
        userId,
        date: todayString,
        status: 'PRESENT',
        checkInAt: new Date(),
        lat,
        lng,
        locationType
      }
    });

    res.json({ success: true, message: `Attendance marked successfully at ${locationType}`, data: attendance });

  } catch (error: any) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAttendanceMatrix = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query; // optional

    const m = month ? parseInt(month as string) : dayjs().month() + 1;
    const y = year ? parseInt(year as string) : dayjs().year();
    
    // YYYY-MM prefix
    const monthPrefix = `${y}-${m.toString().padStart(2, '0')}`;

    // Get all users (maybe filter out Admin?)
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });

    const attendances = await prisma.dailyAttendance.findMany({
      where: {
        date: {
          startsWith: monthPrefix
        }
      }
    });

    // Group by User
    const matrix: any = {};
    users.forEach(u => {
      matrix[u.id] = {
        user: u,
        records: {} // map of day (1-31) to status
      };
    });

    attendances.forEach(att => {
      if (matrix[att.userId]) {
        // att.date is YYYY-MM-DD
        const day = parseInt(att.date.split('-')[2]);
        matrix[att.userId].records[day] = att;
      }
    });

    res.json({ success: true, data: Object.values(matrix) });
  } catch (error: any) {
    console.error('Error fetching matrix:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
