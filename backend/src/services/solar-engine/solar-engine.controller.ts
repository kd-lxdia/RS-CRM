import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../../lib/clients';
import { runAnnualShadingAnalysis, getSunPosition } from './shadow-engine';
import type { AnnualShadingInput } from './shadow-engine';
import {
  recommendSystemSize,
  calculatePanelCount,
  calculateAnnualGeneration,
  calculateSubsidy,
  calculateFinancials,
  calculateCO2,
  validateRoofForSystem,
  calculateStringConfig,
} from './solar-calculator';
import { SOLAR_PANELS } from './panel-database';
import { SOLAR_INVERTERS } from './inverter-database';

// ── Size Recommendation ───────────────────────────────────────────────────────

export const sizeSystem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { monthlyBill, tariff, peakSunHours } = req.body;
    if (!monthlyBill || !tariff) {
      return res.status(400).json({ success: false, error: { message: 'monthlyBill and tariff are required' } });
    }
    const result = recommendSystemSize({
      monthlyBillAvg: Number(monthlyBill),
      tariffPerUnit: Number(tariff),
      peakSunHours: peakSunHours ? Number(peakSunHours) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ── Full Proposal Calculator ──────────────────────────────────────────────────

export const calculateFull = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      systemKw, panelWattage, totalSystemCost, subsidyScheme, state,
      tariffPerUnit, monthlyBill,
      roofAreaSqFt,
      loanAmount, loanRatePercent, loanTenureMonths,
      panelSpec, inverterSpec,
      panelCount: overridePanelCount,
    } = req.body;

    if (!systemKw || !tariffPerUnit) {
      return res.status(400).json({ success: false, error: { message: 'systemKw and tariffPerUnit are required' } });
    }

    const generation = calculateAnnualGeneration({ systemKw: Number(systemKw) });
    
    const subsidy = calculateSubsidy({
      systemKw: Number(systemKw),
      scheme: subsidyScheme || 'BOTH',
      state: state || 'DELHI',
    });

    const financials = calculateFinancials({
      totalSystemCost: Number(totalSystemCost || 0),
      subsidyAmount: subsidy.totalSubsidy,
      annualKwh: generation.annualKwh,
      tariffPerUnit: Number(tariffPerUnit),
      loanAmount: loanAmount ? Number(loanAmount) : undefined,
      loanRatePercent: loanRatePercent ? Number(loanRatePercent) : undefined,
      loanTenureMonths: loanTenureMonths ? Number(loanTenureMonths) : undefined,
    });

    const co2 = calculateCO2(generation.annualKwh);

    let panelCountResult = null;
    if (panelWattage) {
      panelCountResult = calculatePanelCount(Number(systemKw), Number(panelWattage));
    }

    let roofValidation = null;
    if (roofAreaSqFt && panelWattage) {
      roofValidation = validateRoofForSystem({
        roofAreaSqFt: Number(roofAreaSqFt),
        systemKw: Number(systemKw),
        panelWattage: Number(panelWattage),
      });
    }

    let stringConfig = null;
    if (panelSpec && inverterSpec) {
      const totalPanels = overridePanelCount || (panelWattage ? calculatePanelCount(Number(systemKw), Number(panelWattage)) : 0);
      if (totalPanels > 0) {
        stringConfig = calculateStringConfig({
          panelCount: totalPanels,
          inverterModel: inverterSpec,
          panelSpec,
        });
      }
    }

    res.json({
      success: true,
      data: {
        systemKw,
        panelCount: panelCountResult,
        generation,
        subsidy,
        financials,
        co2,
        roofValidation,
        stringConfig,
      },
    });
  } catch (err) { next(err); }
};

// ── Product Listings ──────────────────────────────────────────────────────────

export const listPanels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, minWattage, maxWattage, isDCR } = req.query;
    let panels = SOLAR_PANELS;
    if (brand) panels = panels.filter(p => p.brand.toLowerCase().includes(String(brand).toLowerCase()));
    if (minWattage) panels = panels.filter(p => p.wattage >= Number(minWattage));
    if (maxWattage) panels = panels.filter(p => p.wattage <= Number(maxWattage));
    if (isDCR !== undefined) panels = panels.filter(p => p.isDCR === (isDCR === 'true'));
    res.json({ success: true, data: panels });
  } catch (err) { next(err); }
};

export const listInverters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, minKw, maxKw, phase } = req.query;
    let inverters = SOLAR_INVERTERS;
    if (brand) inverters = inverters.filter(i => i.brand.toLowerCase().includes(String(brand).toLowerCase()));
    if (minKw) inverters = inverters.filter(i => i.capacityKw >= Number(minKw));
    if (maxKw) inverters = inverters.filter(i => i.capacityKw <= Number(maxKw));
    if (phase) inverters = inverters.filter(i => i.phase === phase);
    res.json({ success: true, data: inverters });
  } catch (err) { next(err); }
};

// ── Subsidy Slabs ─────────────────────────────────────────────────────────────

export const getSubsidySlabs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slabs = {
      pmSuryaGhar: [
        { range: '0–1 kW', ratePerKw: 30000 },
        { range: '1–2 kW', ratePerKw: 30000 },
        { range: '2–3 kW', ratePerKw: 18000 },
        { range: '> 3 kW', cap: 78000 },
      ],
      delhiCmScheme: [
        { range: '≤ 3 kW', ratePerKw: 2000 },
        { range: '> 3 kW', flatAmount: 6000 },
      ],
    };
    res.json({ success: true, data: slabs });
  } catch (err) { next(err); }
};

// ── Shading Report (Redis-cached, 24hr TTL) ───────────────────────────────────

let redisClient: any = null;
try {
  // Lazy-load ioredis so the module still boots without Redis
  const Redis = require('ioredis');
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redisClient.on('error', () => { redisClient = null; });
} catch { /* Redis not available — will skip cache */ }

export const shadingReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: AnnualShadingInput = req.body;

    if (!input || !input.panels || !input.lat || !input.lng) {
      return res.status(400).json({ success: false, error: { message: 'panels, lat, lng are required' } });
    }

    // Deterministic cache key: SHA-256 of canonical JSON
    const cacheKey = `shading:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;

    // Try Redis cache first
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const report = JSON.parse(cached);
          return res.json({ success: true, data: report, cached: true });
        }
      } catch { /* cache miss — continue */ }
    }

    // Run the simulation (CPU-bound, typically <500ms for <100 panels)
    const report = runAnnualShadingAnalysis(input);

    // Cache for 24 hours
    if (redisClient) {
      try { await redisClient.setex(cacheKey, 86400, JSON.stringify(report)); } catch { /* non-fatal */ }
    }

    res.json({ success: true, data: report, cached: false });
  } catch (err) { next(err); }
};

// ── Quick Sun Position (for UI time-of-day simulation) ───────────────────────

export const sunPosition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat = 28.6144, lng = 77.209, date, hour } = req.query;
    const d = date ? new Date(String(date)) : new Date();
    const sun = getSunPosition({ date: d, lat: Number(lat), lng: Number(lng), clockHour: hour ? Number(hour) : undefined });
    res.json({ success: true, data: sun });
  } catch (err) { next(err); }
};
