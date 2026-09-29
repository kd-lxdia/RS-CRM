import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';

export const listZones = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await prisma.zone.findMany({
      include: {
        _count: {
          select: { users: { where: { role: 'SALESPERSON', isActive: true } } }
        }
      }
    });
    
    // Map _count to salespersonCount for the frontend
    const mapped = zones.map((z: any) => ({
      ...z,
      salespersonCount: z._count.users,
      _count: undefined
    }));
    
    res.json({ success: true, data: mapped });
  } catch (err) { next(err); }
};

export const createZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, coordinates, city, parentZoneId } = req.body;
    
    // basic validation
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_GEOJSON', message: 'coordinates must be a valid GeoJSON-like polygon array' } });
    }

    const zone = await prisma.zone.create({
      data: { name, coordinates, city, parentZoneId }
    });
    res.status(201).json({ success: true, data: zone });
  } catch (err) { next(err); }
};

export const updateZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, coordinates, city, parentZoneId } = req.body;
    
    const zone = await prisma.zone.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(coordinates && { coordinates }),
        ...(city && { city }),
        ...(parentZoneId !== undefined && { parentZoneId })
      }
    });
    res.json({ success: true, data: zone });
  } catch (err) { next(err); }
};

export const deleteZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeSalespersons = await prisma.user.count({
      where: { zoneId: req.params.id, role: 'SALESPERSON', isActive: true }
    });

    if (activeSalespersons > 0) {
      return res.status(400).json({ 
        success: false, 
        error: { code: 'ZONE_IN_USE', message: 'Cannot delete zone with active salespersons assigned to it.' } 
      });
    }

    await prisma.zone.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
};

export const getZoneSalespersons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const salespersons = await prisma.user.findMany({
      where: { zoneId: req.params.id, role: 'SALESPERSON' },
      select: { id: true, name: true, email: true, phone: true, isActive: true, lastLoginAt: true }
    });
    res.json({ success: true, data: salespersons });
  } catch (err) { next(err); }
};
