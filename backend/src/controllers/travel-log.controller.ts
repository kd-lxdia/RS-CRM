import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

const prisma = new PrismaClient();

// Helper to calculate distance
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export const submitTravelLog = async (req: Request, res: Response) => {
  const { date, stops, notes } = req.body;
  const userId = req.user!.id; // assuming auth middleware attaches user

  if (!stops || stops.length < 2) {
    return res.status(400).json({ success: false, message: 'At least a start and an end point are required.' });
  }

  // Get petrol rate from settings
  let petrolRate = 5; // default
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'PETROL_RATE_PER_KM' } });
  if (setting && !isNaN(parseFloat(setting.value))) {
    petrolRate = parseFloat(setting.value);
  }

  // Calculate total distance and detailed route
  let totalDistanceKm = 0;
  const routeDetails = [];
  
  for (let i = 0; i < stops.length; i++) {
    const current = stops[i];
    let distanceToThis = 0;
    
    if (i > 0) {
      const prev = stops[i - 1];
      distanceToThis = haversineDistance(prev.lat, prev.lng, current.lat, current.lng);
      totalDistanceKm += distanceToThis;
    }
    
    routeDetails.push({
      ...current,
      distanceFromPrev: distanceToThis,
    });
  }

  const petrolAmount = totalDistanceKm * petrolRate;

  const log = await prisma.travelLog.create({
    data: {
      userId,
      date: new Date(date),
      totalDistanceKm,
      petrolAmount,
      routeDetails,
      notes
    }
  });

  res.status(201).json({ success: true, data: log });
};

export const getTravelLogs = async (req: Request, res: Response) => {
  const { month, year, userId, status } = req.query;

  const where: any = {};
  
  if (userId) {
    where.userId = userId;
  }
  
  if (status) {
    where.status = status;
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
    where.date = {
      gte: startDate,
      lte: endDate,
    };
  }

  const logs = await prisma.travelLog.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true }
      }
    },
    orderBy: { date: 'desc' }
  });

  res.json({ success: true, data: logs });
};

export const updateTravelLogStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const log = await prisma.travelLog.update({
    where: { id },
    data: { status }
  });

  res.json({ success: true, data: log });
};

export const bulkUpdateStatus = async (req: Request, res: Response) => {
  const { logIds, status } = req.body;

  if (!logIds || !Array.isArray(logIds)) {
    return res.status(400).json({ success: false, message: 'logIds array is required' });
  }

  const result = await prisma.travelLog.updateMany({
    where: { id: { in: logIds } },
    data: { status }
  });

  res.json({ success: true, data: result });
};

export const deleteTravelLog = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.travelLog.delete({
    where: { id }
  });

  res.json({ success: true, message: 'Travel log deleted' });
};

export const updateSegmentStatus = async (req: Request, res: Response) => {
  const { id, index } = req.params;
  const { status } = req.body;

  const log = await prisma.travelLog.findUnique({ where: { id } });
  if (!log) {
    return res.status(404).json({ success: false, message: 'Log not found' });
  }

  const routeDetails = log.routeDetails as any[];
  const idx = parseInt(index);
  
  if (!routeDetails || !routeDetails[idx]) {
    return res.status(400).json({ success: false, message: 'Segment not found' });
  }

  routeDetails[idx].status = status;

  // Check overall status based on segments
  let allResolved = true;
  let anyApproved = false;
  let anyRejected = false;
  
  for (let i = 1; i < routeDetails.length; i++) {
    const s = routeDetails[i].status || 'PENDING';
    if (s === 'PENDING') allResolved = false;
    if (s === 'APPROVED') anyApproved = true;
    if (s === 'REJECTED') anyRejected = true;
  }

  let newStatus = log.status;
  if (allResolved) {
    if (anyApproved) newStatus = 'APPROVED';
    else if (anyRejected) newStatus = 'REJECTED';
  } else {
    newStatus = 'PENDING';
  }

  const updatedLog = await prisma.travelLog.update({
    where: { id },
    data: { 
      routeDetails,
      status: newStatus 
    }
  });

  res.json({ success: true, data: updatedLog });
};
