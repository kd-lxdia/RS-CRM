import { Parser } from "json2csv";
import * as XLSX from "xlsx";

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';

export const listLeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, assignedSalesperson, zoneId, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    const user = (req as any).user;
    if (user.dealerId) where.dealerId = user.dealerId;
    
    // Roles scoping
    if (user.role === 'SALESPERSON') {
      where.assignedSalesperson = user.id;
    }

    if (status) where.status = status;
    if (assignedSalesperson) where.assignedSalesperson = assignedSalesperson;
    if (zoneId) where.zoneId = zoneId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          salesperson: { select: { name: true } },
          zone: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ success: true, data: { leads, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) { next(err); }
};

export const getLead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    const user = (req as any).user;
    if (user.dealerId) where.dealerId = user.dealerId;
    if (user.role === 'SALESPERSON') where.assignedSalesperson = user.id;

    const lead = await prisma.lead.findFirst({
      where,
      include: {
        salesperson: { select: { name: true, phone: true } },
        timelineEvents: { orderBy: { createdAt: 'desc' }, include: { performer: { select: { name: true } } } },
        visits: { orderBy: { scheduledAt: 'desc' } },
        proposals: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!lead) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    
    // Fetch polymorphic call logs
    const callLogs = await prisma.callLog.findMany({
      where: { entityType: 'LEAD', entityId: lead.id },
      orderBy: { createdAt: 'desc' },
      include: { caller: { select: { name: true } } }
    });

    res.json({ success: true, data: { ...lead, callLogs } });
  } catch (err) { next(err); }
};

export const updateLead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, statusReason } = req.body;
    const where: any = { id: req.params.id };
    const user = (req as any).user;

    if (user.dealerId) where.dealerId = user.dealerId;
    if (user.role === 'SALESPERSON') where.assignedSalesperson = user.id;

    const existing = await prisma.lead.findFirst({ where });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } });

    // Whitelisted editable fields (edit drawer + status/follow-up/visit modals).
    const data: any = {};
    for (const f of ['name', 'phone', 'email', 'address', 'city', 'pincode', 'mapLink', 'notes', 'status', 'priority', 'lostReason', 'visitDate', 'visitTime']) {
      if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f];
    }
    if (req.body.lat !== undefined && req.body.lat !== '') data.lat = parseFloat(req.body.lat);
    if (req.body.lng !== undefined && req.body.lng !== '') data.lng = parseFloat(req.body.lng);
    if (req.body.followUpDate) data.followUpDate = new Date(req.body.followUpDate);
    if (statusReason && ['LOST', 'NOT_INTERESTED', 'REJECTED'].includes(status)) data.lostReason = statusReason;

    const updated = await prisma.lead.update({ where: { id: req.params.id }, data });

    // Log to timeline if status changed (with reason when given)
    if (status && existing.status !== status) {
      await prisma.timelineEvent.create({
        data: {
          leadId: req.params.id,
          eventType: 'STATUS_UPDATE',
          description: `Status changed from ${existing.status} to ${status}${statusReason ? ` — Reason: ${statusReason}` : ''}`,
          performedBy: user.id
        }
      });
    } else if (statusReason) {
      // Comment / follow-up note without a status change
      await prisma.timelineEvent.create({
        data: {
          leadId: req.params.id,
          eventType: 'NOTE_ADDED',
          description: statusReason,
          performedBy: user.id
        }
      });
    }

    // Scheduling a sales visit also creates a real Visit record (shows in Today Route)
    if (status === 'VISIT_SCHEDULED' && req.body.visitDate) {
      const start = new Date(`${req.body.visitDate}T${req.body.visitTime || '10:00'}:00`);
      await prisma.visit.create({
        data: {
          leadId: req.params.id,
          visitType: 'SALES',
          scheduledAt: start,
          scheduledEndAt: new Date(start.getTime() + 60 * 60 * 1000),
          address: existing.address || existing.city || 'N/A',
          lat: existing.lat,
          lng: existing.lng,
          status: 'SCHEDULED',
          assignedTo: existing.assignedSalesperson,
          scheduledBy: user.id,
        }
      });
      await prisma.timelineEvent.create({
        data: {
          leadId: req.params.id,
          eventType: 'VISIT_SCHEDULED',
          description: `Site visit scheduled for ${req.body.visitDate} at ${req.body.visitTime || '10:00'}`,
          performedBy: user.id
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

export const addCallLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callType, disposition, notes, followUpAt, duration } = req.body;
    const log = await prisma.callLog.create({
      data: {
        entityType: 'LEAD',
        entityId: req.params.id,
        calledBy: (req as any).user.id,
        callType,
        disposition,
        notes,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
        duration: duration ? parseInt(duration) : null,
      },
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) { next(err); }
};

export const convertToCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = { id: req.params.id };
    const user = (req as any).user;
    if (user.dealerId) where.dealerId = user.dealerId;
    if (user.role === 'SALESPERSON') where.assignedSalesperson = user.id;

    const lead = await prisma.lead.findFirst({ where });
    if (!lead) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    
    if (lead.status === 'WON') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_WON', message: 'This lead is already a customer' } });
    }

    // Update Lead
    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: 'WON' }
    });

    // Create Customer record
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUS-${Date.now()}`,
        zoneId: lead.zoneId,
        assignedSalesperson: lead.assignedSalesperson,
        leadId: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone,
        address: lead.address || '',
        city: lead.city || '',
        pincode: lead.pincode || '',
        dealerId: lead.dealerId,
      }
    });

    await prisma.timelineEvent.create({
      data: {
        leadId: req.params.id,
        eventType: 'LEAD_CONVERTED',
        description: `Lead won and transitioned to active Customer profile.`,
        performedBy: user.id
      }
    });

    res.status(201).json({ success: true, data: { lead: updatedLead, customer } });
  } catch (err) { next(err); }
};


export const createLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, phone, email, address, city, pincode, lat, lng, googleMapsLink, notes } = req.body;
      const user = (req as any).user;
      if (!name || !phone) {
        return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "name and phone are required" } });
      }
      const existing = await prisma.lead.findFirst({ where: { phone, ...(user.dealerId ? { dealerId: user.dealerId } : {}) } });
      if (existing) return res.status(400).json({ success: false, error: { code: "DUPLICATE", message: "Lead with this phone number already exists" } });  

      // Grab fallback zoneId and salesperson
      const fallbackZone = await prisma.zone.findFirst();
      const fallbackSales = await prisma.user.findFirst({ where: { role: "SALESPERSON" }});
      const finalZoneId = user.zoneId ? user.zoneId : (fallbackZone ? fallbackZone.id : "dummy-zone");
      const finalSalesperson = user.role === "SALESPERSON" ? user.id : (fallbackSales ? fallbackSales.id : "dummy-sales");

      let rawLeadId: string;
      const existingRaw = await prisma.rawLead.findFirst({ where: { phone, ...(user.dealerId ? { dealerId: user.dealerId } : {}) } });
      if (existingRaw) rawLeadId = existingRaw.id;
      else {
        const rawLead = await prisma.rawLead.create({
          data: { name, phone, email: email || null, address: address || null, city: city || null, pincode: pincode || null, source: "MANUAL", dealerId: user.dealerId ?? null }
        });
        rawLeadId = rawLead.id;
      }
      
      const leadCode = `LD-${Date.now()}`;
      
      const leadAddress = googleMapsLink ? `${address || ""} (Map: ${googleMapsLink})`.trim() : address || null;

      const lead = await prisma.lead.create({
        data: { 
          leadCode, rawLeadId, name, phone, 
          email: email || null,
          address: leadAddress, 
          city: city || null, 
          pincode: pincode || null,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          zoneId: finalZoneId, 
          assignedSalesperson: finalSalesperson, 
          dealerId: user.dealerId ?? null 
        },
        include: { salesperson: { select: { name: true } }, zone: { select: { name: true } } }
      });
      
      if (notes) {
        await prisma.timelineEvent.create({
          data: {
             leadId: lead.id,
             eventType: "NOTE_ADDED",
             description: notes,
             performedBy: user.id
          }
        });
      }
      
      res.status(201).json({ success: true, data: lead });
    } catch (err) { next(err); }
  };

  export const bulkUploadLeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file uploaded" } });
    const user = (req as any).user;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
    if (rows.length === 0) return res.status(400).json({ success: false, error: { code: "EMPTY", message: "Empty file" } });

    const inserted = [];
    const errors = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const record = rows[idx];
      if (!record.name || !record.phone) {
        errors.push({ row: idx + 2, reason: "Missing required: name, phone" }); continue;
      }
      try {
        let rawLeadId: string;
        const existingRaw = await prisma.rawLead.findFirst({ where: { phone: String(record.phone) } });
        if (existingRaw) rawLeadId = existingRaw.id;
        else {
          const rawLead = await prisma.rawLead.create({
            data: { name: record.name, phone: String(record.phone), source: "EXCEL_UPLOAD", dealerId: user.dealerId ?? null }
          });
          rawLeadId = rawLead.id;
        }
        const lead = await prisma.lead.create({
          data: { leadCode: `LD-${Date.now()}-${idx}`, rawLeadId, name: record.name, phone: String(record.phone), email: record.email || null, address: record.address || null, city: record.city || null, pincode: String(record.pincode || ""), zoneId: record.zoneId, assignedSalesperson: record.assignedSalesperson, dealerId: user.dealerId ?? null }
        });
        inserted.push(lead);
      } catch (err) { errors.push({ row: idx + 2, reason: "Failed to save record" }); }
    }
    res.json({ success: true, data: { inserted: inserted.length, errors } });
  } catch (err) { next(err); }
};

export const exportLeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, zoneId, assignedSalesperson, dateFrom, dateTo } = req.query;
    const user = (req as any).user;
    const where: any = {};
    if (user.dealerId) where.dealerId = user.dealerId;
    if (user.role === "SALESPERSON") where.assignedSalesperson = user.id;
    if (status) where.status = status;
    if (zoneId) where.zoneId = zoneId;
    if (assignedSalesperson) where.assignedSalesperson = assignedSalesperson;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }
    const leads = await prisma.lead.findMany({ where, include: { salesperson: { select: { name: true } }, zone: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
    if (leads.length === 0) return res.status(400).json({ success: false, error: { code: "NO_DATA", message: "No leads found" } });

    const data = leads.map((lead: any) => ({
      "Lead Code": lead.leadCode, "Name": lead.name, "Phone": lead.phone, "Status": lead.status,
      "Zone": lead.zone?.name || "", "Assigned Salesperson": lead.salesperson?.name || "", "Created At": new Date(lead.createdAt).toISOString().split("T")[0]
    }));
    
    const csv = new Parser().parse(data);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send(csv);
  } catch (err) { next(err); }
};
