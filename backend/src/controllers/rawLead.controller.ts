import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { AuthenticatedRequest } from '../middlewares/auth';

// GET /api/raw-leads
export const listRawLeads = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, assignedTo, source, followUpFrom, followUpTo, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (source) where.source = source;
    if (followUpFrom || followUpTo) {
      where.followUpAt = {};
      if (followUpFrom) where.followUpAt.gte = new Date(followUpFrom as string);
      if (followUpTo) where.followUpAt.lte = new Date(followUpTo as string);
    }

    const [rawLeads, total] = await Promise.all([
      prisma.rawLead.findMany({
        where,
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.rawLead.count({ where }),
    ]);
    res.json({ success: true, data: { rawLeads, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) { next(err); }
};

// POST /api/raw-leads
export const createRawLead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, address, city, pincode, source = 'MANUAL', assignedTo, campaignId } = req.body;
    const rawLead = await prisma.rawLead.create({
      data: { name, phone, email, address, city, pincode, source, assignedTo, campaignId, dealerId: req.user?.dealerId ?? null },
    });
    res.status(201).json({ success: true, data: rawLead });
  } catch (err) { next(err); }
};

// POST /api/raw-leads/bulk
export const bulkCreateRawLeads = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const records: any[] = req.body.records || [];
    if (records.length > 5000) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Maximum 5000 records per upload' } });
    }

    const inserted: string[] = [];
    const duplicates: string[] = [];
    const errors: { row: number; reason: string }[] = [];

    // Collect existing phones for deduplication
    const phones = records.map((r: any) => r.phone).filter(Boolean);
    const existing = await prisma.rawLead.findMany({
      where: { phone: { in: phones }, ...(req.user?.dealerId ? { dealerId: req.user.dealerId } : {}) },
      select: { phone: true },
    });
    const existingPhones = new Set(existing.map((r: { phone: string }) => r.phone));

    const toInsert: any[] = [];
    records.forEach((record: Record<string, string>, idx: number) => {
      if (!record.name || !record.phone) {
        errors.push({ row: idx + 1, reason: 'Missing required fields: name, phone' });
        return;
      }
      if (existingPhones.has(record.phone)) {
        duplicates.push(record.phone);
        return;
      }
      existingPhones.add(record.phone); // prevent intra-batch duplicates
      toInsert.push({
        name: record.name,
        phone: record.phone,
        email: record.email || null,
        address: record.address || null,
        city: record.city || null,
        pincode: record.pincode || null,
        source: record.source || 'EXCEL_UPLOAD',
        dealerId: req.user?.dealerId ?? null,
      });
    });

    if (toInsert.length > 0) {
      await prisma.rawLead.createMany({ data: toInsert });
      inserted.push(...toInsert.map((r) => r.phone));
    }

    res.json({ success: true, data: { inserted: inserted.length, duplicates: duplicates.length, errors } });
  } catch (err) { next(err); }
};

// GET /api/raw-leads/:id
export const getRawLead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const rawLead = await prisma.rawLead.findFirst({ where, include: { assignee: { select: { name: true } } } });
    if (!rawLead) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    res.json({ success: true, data: rawLead });
  } catch (err) { next(err); }
};

// PATCH /api/raw-leads/:id
export const updateRawLead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    if (req.user?.dealerId) where.dealerId = req.user.dealerId;
    const existing = await prisma.rawLead.findFirst({ where });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    const { status, followUpAt, assignedTo } = req.body;
    const updated = await prisma.rawLead.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(followUpAt && { followUpAt: new Date(followUpAt) }),
        ...(assignedTo && { assignedTo }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// POST /api/raw-leads/:id/call-log
export const addCallLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { callType, disposition, notes, followUpAt, duration } = req.body;
    const log = await prisma.callLog.create({
      data: {
        entityType: 'RAW_LEAD',
        entityId: req.params.id,
        calledBy: req.user!.id,
        callType,
        disposition,
        notes,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
        duration: duration ? parseInt(duration) : null,
      },
    });
    // Update raw lead status based on disposition
    const statusMap: Record<string, string> = {
      FOLLOW_UP: 'FOLLOW_UP',
      NOT_INTERESTED: 'NOT_INTERESTED',
      CALL_NOT_RECEIVED: 'CALL_NOT_RECEIVED',
      WRONG_NUMBER: 'WRONG_NUMBER',
      INTERESTED: 'INTERESTED',
    };
    if (statusMap[disposition]) {
      await prisma.rawLead.update({
        where: { id: req.params.id },
        data: {
          status: statusMap[disposition] as any,
          followUpAt: followUpAt ? new Date(followUpAt) : undefined,
        },
      });
    }
    res.status(201).json({ success: true, data: log });
  } catch (err) { next(err); }
};

// POST /api/raw-leads/:id/convert
export const convertToLead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawLead = await prisma.rawLead.findFirst({ where: { id: req.params.id } });
    if (!rawLead) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Raw lead not found' } });
    if (rawLead.status === 'CONVERTED') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_CONVERTED', message: 'This lead is already converted' } });
    }

    const { assignedSalesperson, zoneId } = req.body;

    const salespersonId = (typeof assignedSalesperson === 'string' && assignedSalesperson.trim().length > 0)
      ? assignedSalesperson
      : req.user?.id;

    if (!salespersonId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'assignedSalesperson is required' },
      });
    }

    const salesperson = await prisma.user.findFirst({
      where: {
        id: salespersonId,
        isActive: true,
        ...(rawLead.dealerId ? { dealerId: rawLead.dealerId } : {}),
      },
    });

    if (!salesperson) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid assignedSalesperson' },
      });
    }

    let resolvedZoneId = typeof zoneId === 'string' && zoneId.trim().length > 0 ? zoneId : null;

    if (resolvedZoneId) {
      const zoneExists = await prisma.zone.findUnique({ where: { id: resolvedZoneId } });
      if (!zoneExists) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid zoneId' },
        });
      }
    } else {
      const fallbackZone = await prisma.zone.findFirst({
        where: rawLead.city ? { city: rawLead.city } : undefined,
        orderBy: { name: 'asc' },
      });

      if (!fallbackZone) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'zoneId is required when no matching zone exists for this lead' },
        });
      }

      resolvedZoneId = fallbackZone.id;
    }

    // Generate leadCode: LEAD-YYYY-NNNN
    const year = new Date().getFullYear();
    const count = await prisma.lead.count();
    const leadCode = `LEAD-${year}-${String(count + 1).padStart(4, '0')}`;

    const lead = await prisma.lead.create({
      data: {
        leadCode,
        rawLeadId: rawLead.id,
        name: rawLead.name,
        phone: rawLead.phone,
        email: rawLead.email,
        address: rawLead.address,
        city: rawLead.city,
        pincode: rawLead.pincode,
        assignedSalesperson: salesperson.id,
        zoneId: resolvedZoneId,
        dealerId: rawLead.dealerId,
      },
    });

    await prisma.rawLead.update({ where: { id: rawLead.id }, data: { status: 'CONVERTED' } });

    res.status(201).json({ success: true, data: lead });
  } catch (err) { next(err); }
};
