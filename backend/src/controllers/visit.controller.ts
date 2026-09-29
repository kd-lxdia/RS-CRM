import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { haversineDistance, getAddressCoordinates } from '../utils/geo';
import { optimizeRoute } from '../services/route.service';
import { getIO } from '../lib/socket';
import { uploadBufferToS3, uploadBase64ToS3 } from '../utils/s3';

export const listVisits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, status, assignedTo, date, customerId, leadId } = req.query;
    const where: any = {};
    const user = (req as any).user;

    // Scoping
    if (user.role === 'SALESPERSON') {
      where.assignedTo = user.id;
    }

    if (type) where.visitType = type;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (customerId) where.customerId = customerId;
    if (leadId) where.leadId = leadId;
    
    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date as string);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        lead: { select: { name: true, phone: true } },
        customer: { select: { name: true, phone: true } },
        assignee: { select: { name: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    res.json({ success: true, data: visits });
  } catch (err) { next(err); }
};

export const scheduleVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, customerId, visitType, scheduledAt, notes, assignedTo } = req.body;
    const user = (req as any).user;

    if (!leadId && !customerId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Lead or Customer requires mapping' } });
    }

    // Resolve address boundaries
    let targetDoc: any = null;
    if (leadId) targetDoc = await prisma.lead.findUnique({ where: { id: leadId } });
    else if (customerId) targetDoc = await prisma.customer.findUnique({ where: { id: customerId } });

    if (!targetDoc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Entity not found' } });
    
    const address = targetDoc.address || `${targetDoc.city} ${targetDoc.pincode}`.trim();
    let { lat, lng } = targetDoc;

    if (!lat || !lng) {
      try {
        const coords = await getAddressCoordinates(address);
        lat = coords.lat;
        lng = coords.lng;
        // Optionally backfill original lead/customer coordinates
        if (leadId) await prisma.lead.update({ where: { id: leadId }, data: { lat, lng } });
        if (customerId) await prisma.customer.update({ where: { id: customerId }, data: { lat, lng } });
      } catch (e) {
        // Fallback without coordinates logic 
      }
    }

    const endTime = new Date(scheduledAt);
    endTime.setHours(endTime.getHours() + 1); // Mock 1 Hr Duration Check

    const visit = await prisma.visit.create({
      data: {
        leadId,
        customerId,
        visitType,
        scheduledAt: new Date(scheduledAt),
        scheduledEndAt: endTime,
        address,
        lat,
        lng,
        assignedTo,
        scheduledBy: user.id,
        notes
      }
    });

    // Generate Timeline Events
    await prisma.timelineEvent.create({
      data: {
        leadId,
        customerId,
        eventType: 'VISIT_SCHEDULED',
        description: `Visit scheduled for ${visitType} on ${visit.scheduledAt.toDateString()}`,
        performedBy: user.id
      }
    });

    // Notify assigned salesperson via WebSocket
    try {
      const io = getIO();
      io.to(`user_${assignedTo}`).emit('notification', {
        title: 'New Visit Assigned',
        message: `You have a new ${visitType} scheduled for ${visit.scheduledAt.toDateString()}`,
        visitId: visit.id
      });
    } catch(e) {} // skip if socket.io unavailable locally

    // External WhatsApp/Email Mocks
    console.log(`[EXTERNAL NOTIFICATION MOCK] Sent WhatsApp to ${targetDoc.phone} matching Scheduled Visit on ${scheduledAt}`);

    res.status(201).json({ success: true, data: visit });
  } catch(err) { next(err); }
};

export const getVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        customer: true,
        assignee: { select: { id: true, name: true, phone: true } },
        siteSurveys: true // include form data
      }
    });
    if (!visit) return res.status(404).json({ success: false });
    res.json({ success: true, data: visit });
  } catch(err) { next(err); }
};

export const rescheduleVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scheduledAt } = req.body;
    const endTime = new Date(scheduledAt);
    endTime.setHours(endTime.getHours() + 1);

    const updated = await prisma.visit.update({
      where: { id: req.params.id },
      data: { scheduledAt: new Date(scheduledAt), scheduledEndAt: endTime }
    });

    res.json({ success: true, data: updated });
  } catch(err) { next(err); }
};

export const cancelVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.visit.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });
    res.json({ success: true, data: updated });
  } catch(err) { next(err); }
};

export const getMyRoute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    const visits = await prisma.visit.findMany({
      where: { assignedTo: user.id, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      include: { lead: { select: { name: true, address: true } }, customer: { select: { name: true, address: true } } }
    });

    const route = optimizeRoute(visits);
    res.json({ success: true, data: route });
  } catch(err) { next(err); }
};

export const getCalendar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = req.query;
    const user = (req as any).user;
    const where: any = {};
    if (user.role === 'SALESPERSON') where.assignedTo = user.id;

    if (start && end) {
      where.scheduledAt = { gte: new Date(start as string), lte: new Date(end as string) };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: { lead: { select: { name: true } }, customer: { select: { name: true } } }
    });

    const parsedEvents = visits.map(v => ({
      id: v.id,
      title: `${v.visitType} - ${v.lead?.name || v.customer?.name}`,
      start: v.scheduledAt,
      end: v.scheduledEndAt,
      backgroundColor: v.status === 'COMPLETED' ? '#10b981' : v.status === 'CANCELLED' ? '#ef4444' : '#3b82f6'
    }));

    res.json({ success: true, data: parsedEvents });
  } catch(err) { next(err); }
};

export const getVisitForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const survey = await prisma.siteSurvey.findFirst({ where: { visitId: req.params.id } });
    res.json({ success: true, data: survey || {} });
  } catch(err) { next(err); }
};

export const updateVisitForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visitId = req.params.id;
    const data = req.body;
    // Map form properties to SiteSurvey table (simplified match against Schema model 16)
    
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit || !visit.customerId) return res.status(400).json({ success: false, error: { message: 'Visit lacks Customer bindings' } });

    const existing = await prisma.siteSurvey.findFirst({ where: { visitId } });
    
    let survey;
    if (existing) {
      survey = await prisma.siteSurvey.update({
        where: { id: existing.id },
        data: {
          roofDimensions: (data.systemSizeKw ? { size: data.systemSizeKw } : existing.roofDimensions) as any,
          roofType: data.roofType || existing.roofType,
          panelCount: data.panelCount || existing.panelCount,
          inverterCount: 1,
          inverterModel: data.inverterBrand || existing.inverterModel,
          specialNotes: data.notes || existing.specialNotes
        }
      });
    } else {
      survey = await prisma.siteSurvey.create({
        data: {
          visitId,
          customerId: visit.customerId,
          conductedBy: (req as any).user.id,
          roofDimensions: (data.systemSizeKw ? { size: data.systemSizeKw } : {}) as any,
          roofType: data.roofType || 'Unknown',
          panelCount: data.panelCount || 0,
          inverterCount: 1,
          inverterModel: data.inverterBrand || 'Unknown',
          specialNotes: data.notes
        }
      });
    }
    
    res.json({ success: true, data: survey });
  } catch(err) { next(err); }
};

export const completeVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await prisma.visit.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' }
    });

    await prisma.timelineEvent.create({
      data: {
        leadId: visit.leadId,
        customerId: visit.customerId,
        eventType: 'VISIT_COMPLETED',
        description: 'Sales visit completed successfully by representative.',
        performedBy: (req as any).user.id
      }
    });

    res.json({ success: true, data: visit });
  } catch(err) { next(err); }
};

export const checkInVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_COORDS', message: 'Current lat and lng are required' } });
    }

    const visit = await prisma.visit.findUnique({ where: { id: req.params.id } });
    if (!visit) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } });
    
    if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Visit is not active' } });
    }

    if (!visit.lat || !visit.lng) {
      return res.status(400).json({ success: false, error: { code: 'NO_TARGET_COORDS', message: 'Visit location coordinates not known' } });
    }

    const distance = haversineDistance(lat, lng, visit.lat, visit.lng);
    const requiredRadius = 200; // 200 meters

    if (distance > requiredRadius) {
      return res.json({ 
        success: true, 
        data: { canCheckIn: false, distance: Math.round(distance), required: requiredRadius } 
      });
    }

    // Within bounds, create attendance log and update visit
    await prisma.attendanceLog.create({
      data: {
        userId: (req as any).user.id,
        visitId: req.params.id,
        lat,
        lng,
        distance
      }
    });

    const updated = await prisma.visit.update({
      where: { id: req.params.id },
      data: { status: 'CHECKED_IN', checkInAt: new Date() }
    });

    res.json({ success: true, data: { canCheckIn: true, distance: Math.round(distance), visit: updated } });
  } catch(err) { next(err); }
};

export const uploadDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visitId = req.params.id;
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit || !visit.customerId) return res.status(400).json({ success: false, error: { message: 'Visit lacks Customer' } });

    const customerId = visit.customerId;
    const timestamp = Date.now();
    const uploadedDocs = [];

    // 1. Handle base64 signature
    if (req.body.signature) {
      const url = await uploadBase64ToS3(req.body.signature, `documents/${customerId}/signature/${timestamp}.png`);
      const doc = await prisma.document.create({
        data: { customerId, type: 'CUSTOMER_SIGNATURE', url, uploadedBy: (req as any).user.id }
      });
      uploadedDocs.push(doc);
    }

    // 2. Handle multipart files via Multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files) {
      for (const fieldName of Object.keys(files)) {
        for (const file of files[fieldName]) {
           const typeMap: any = { aadhaar_front: 'AADHAAR_FRONT', aadhaar_back: 'AADHAAR_BACK', electricity_bill: 'ELECTRICITY_BILL', site_photos: 'SITE_PHOTO' };
           const docType = typeMap[fieldName] || 'OTHER';
           const url = await uploadBufferToS3(file.buffer, `documents/${customerId}/${docType}/${timestamp}_${file.originalname}`, file.mimetype);
           
           const doc = await prisma.document.create({
             data: { customerId, type: docType, url, uploadedBy: (req as any).user.id }
           });
           uploadedDocs.push(doc);
        }
      }
    }

    res.json({ success: true, data: uploadedDocs });
  } catch (err) { next(err); }
};

export const checkInStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_COORDS', message: 'Current lat and lng are required to calculate distance' } });
    }

    const visit = await prisma.visit.findUnique({ where: { id: req.params.id } });
    if (!visit) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } });

    if (!visit.lat || !visit.lng) {
      return res.json({ success: true, data: { canCheckIn: false, distance: null, reason: 'No visit coordinates' } });
    }

    const distance = haversineDistance(Number(lat), Number(lng), visit.lat, visit.lng);
    const canCheckIn = distance <= 200;

    res.json({ success: true, data: { canCheckIn, distance: Math.round(distance), required: 200 } });
  } catch (err) { next(err); }
};
