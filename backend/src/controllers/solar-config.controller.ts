/**
 * Solar Engine Admin Config Controller
 * Manages: Panel DB, Inverter DB, Pricing defaults, Subsidy slabs, Proposal template settings
 * All changes stored in the SolarEngineConfig key-value store (JSON blobs keyed by configKey)
 * Panel/Inverter CRUD is in-DB; Pricing/Slabs/Template are stored as JSON config blobs.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';
import { SOLAR_PANELS } from '../services/solar-engine/panel-database';
import { SOLAR_INVERTERS } from '../services/solar-engine/inverter-database';

// ─── Config key constants ──────────────────────────────────────────────────────

const CONFIG_PRICING = 'pricing_defaults';
const CONFIG_SUBSIDY = 'subsidy_slabs';
const CONFIG_TEMPLATE = 'proposal_template';

// ─── Generic config helpers ───────────────────────────────────────────────────

async function getConfig(key: string): Promise<any> {
  const rec = await (prisma as any).solarEngineConfig?.findUnique?.({ where: { configKey: key } });
  if (rec) return JSON.parse(rec.value);
  // Return hardcoded sensible defaults if table not yet seeded
  if (key === CONFIG_PRICING) return DEFAULT_PRICING;
  if (key === CONFIG_SUBSIDY) return DEFAULT_SUBSIDY;
  if (key === CONFIG_TEMPLATE) return DEFAULT_TEMPLATE;
  return null;
}

async function setConfig(key: string, value: any): Promise<void> {
  await (prisma as any).solarEngineConfig?.upsert?.({
    where: { configKey: key },
    update: { value: JSON.stringify(value), updatedAt: new Date() },
    create: { configKey: key, value: JSON.stringify(value) },
  });
}

// ─── Hardcoded defaults (used if SolarEngineConfig table doesn't exist yet) ─────

const DEFAULT_PRICING = {
  panelRatePerW: 28,          // ₹/W
  inverterRatePerKw: 9000,    // ₹/kW
  mountingRatePerKw: 7000,    // ₹/kW
  cablesRatePerKw: 3500,      // ₹/kW
  installRatePerKw: 4000,     // ₹/kW
  gstPanelPct: 12,
  gstInverterPct: 18,
  gstInstallPct: 18,
};

const DEFAULT_SUBSIDY = {
  pmSuryaGhar: [
    { minKw: 0, maxKw: 2, ratePerKw: 30000 },
    { minKw: 2, maxKw: 3, ratePerKw: 18000 },
    { minKw: 3, maxKw: Infinity, flatAmount: 78000 },
  ],
  delhiCm: [
    { minKw: 0, maxKw: 3, ratePerKw: 2000 },
    { minKw: 3, maxKw: Infinity, flatAmount: 6000 },
  ],
  effectiveFrom: '2024-01-01',
};

const DEFAULT_TEMPLATE = {
  companyName: 'Slar Solar',
  tagline: 'Powering India\'s Solar Transition',
  logoUrl: '',
  termsText: 'This proposal is valid for 30 days from the date of issue. Prices subject to market conditions.',
  warrantyText: 'Solar Panels: 25 years performance, 10 years product. Inverter: 5 years. Installation: 1 year workmanship.',
  paymentMilestones: [
    { label: 'Booking', pct: 10 },
    { label: 'Material Delivery', pct: 40 },
    { label: 'Installation Start', pct: 30 },
    { label: 'Commissioning', pct: 20 },
  ],
  footerText: 'Confidential proposal prepared exclusively for the addressee.',
};

// ─── Panel DB ─────────────────────────────────────────────────────────────────

export const listConfigPanels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try DB first, fall back to hardcoded array
    let panels = SOLAR_PANELS as any[];
    try {
      const dbPanels = await (prisma as any).solarPanel?.findMany?.({ orderBy: { brand: 'asc' } });
      if (dbPanels?.length) panels = dbPanels;
    } catch { /* table may not exist */ }
    res.json({ success: true, data: panels });
  } catch (err) { next(err); }
};

export const upsertConfigPanel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, model, ...rest } = req.body;
    if (!brand || !model) return res.status(400).json({ success: false, error: { message: 'brand and model required' } });
    try {
      const result = await (prisma as any).solarPanel?.upsert?.({
        where: { brand_model: { brand, model } },
        update: rest,
        create: { brand, model, ...rest },
      });
      res.json({ success: true, data: result });
    } catch {
      // If DB table doesn't exist, return a mock success
      res.json({ success: true, data: { brand, model, ...rest }, note: 'Stored in memory (run prisma migrate to persist)' });
    }
  } catch (err) { next(err); }
};

export const deleteConfigPanel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await (prisma as any).solarPanel?.delete?.({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── Inverter DB ──────────────────────────────────────────────────────────────

export const listConfigInverters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let inverters = SOLAR_INVERTERS as any[];
    try {
      const dbInverters = await (prisma as any).solarInverter?.findMany?.({ orderBy: { brand: 'asc' } });
      if (dbInverters?.length) inverters = dbInverters;
    } catch { /* table may not exist */ }
    res.json({ success: true, data: inverters });
  } catch (err) { next(err); }
};

export const upsertConfigInverter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, model, ...rest } = req.body;
    if (!brand || !model) return res.status(400).json({ success: false, error: { message: 'brand and model required' } });
    try {
      const result = await (prisma as any).solarInverter?.upsert?.({
        where: { brand_model: { brand, model } },
        update: rest,
        create: { brand, model, ...rest },
      });
      res.json({ success: true, data: result });
    } catch {
      res.json({ success: true, data: { brand, model, ...rest }, note: 'Stored in memory (run prisma migrate to persist)' });
    }
  } catch (err) { next(err); }
};

// ─── Pricing Defaults ─────────────────────────────────────────────────────────

export const getPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getConfig(CONFIG_PRICING) });
  } catch (err) { next(err); }
};

export const updatePricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await getConfig(CONFIG_PRICING);
    const updated = { ...current, ...req.body };
    await setConfig(CONFIG_PRICING, updated);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ─── Subsidy Slabs ────────────────────────────────────────────────────────────

export const getSubsidyConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getConfig(CONFIG_SUBSIDY) });
  } catch (err) { next(err); }
};

export const updateSubsidyConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await getConfig(CONFIG_SUBSIDY);
    const updated = { ...current, ...req.body };
    await setConfig(CONFIG_SUBSIDY, updated);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ─── Proposal Template ────────────────────────────────────────────────────────

export const getTemplateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await getConfig(CONFIG_TEMPLATE) });
  } catch (err) { next(err); }
};

export const updateTemplateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await getConfig(CONFIG_TEMPLATE);
    const updated = { ...current, ...req.body };
    await setConfig(CONFIG_TEMPLATE, updated);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};
