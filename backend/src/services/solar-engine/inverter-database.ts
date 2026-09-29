import { PrismaClient } from '@prisma/client';

export interface InverterData {
  brand: string;
  model: string;
  capacityKw: number;
  maxInputVoltage: number;
  mpptVoltageMin: number;
  mpptVoltageMax: number;
  maxInputCurrent: number;
  mpptCount: number;
  efficiency: number;    // e.g. 0.984
  warranty_years: number;
  phase: 'SINGLE' | 'THREE';
}

export const SOLAR_INVERTERS: InverterData[] = [
  // ── HAVELLS ────────────────────────────────────────────────────────────────
  {
    brand: 'Havells', model: 'Solar UNO Trio 3.3 TL', capacityKw: 3.3,
    maxInputVoltage: 600, mpptVoltageMin: 100, mpptVoltageMax: 550,
    maxInputCurrent: 20, mpptCount: 2, efficiency: 0.974,
    warranty_years: 5, phase: 'SINGLE',
  },
  {
    brand: 'Havells', model: 'Solar UNO Trio 5 TL', capacityKw: 5,
    maxInputVoltage: 600, mpptVoltageMin: 100, mpptVoltageMax: 550,
    maxInputCurrent: 24, mpptCount: 2, efficiency: 0.976,
    warranty_years: 5, phase: 'SINGLE',
  },
  // ── SOLIS ──────────────────────────────────────────────────────────────────
  {
    brand: 'Solis', model: 'S5-GR3P10K', capacityKw: 10,
    maxInputVoltage: 1000, mpptVoltageMin: 200, mpptVoltageMax: 800,
    maxInputCurrent: 25, mpptCount: 3, efficiency: 0.985,
    warranty_years: 10, phase: 'THREE',
  },
  {
    brand: 'Solis', model: 'RHI-3P6K-HVES-5G', capacityKw: 6,
    maxInputVoltage: 1100, mpptVoltageMin: 200, mpptVoltageMax: 950,
    maxInputCurrent: 26, mpptCount: 2, efficiency: 0.983,
    warranty_years: 10, phase: 'THREE',
  },
  // ── GROWATT ────────────────────────────────────────────────────────────────
  {
    brand: 'Growatt', model: 'MIN 3000 TL-X', capacityKw: 3,
    maxInputVoltage: 600, mpptVoltageMin: 70, mpptVoltageMax: 560,
    maxInputCurrent: 20, mpptCount: 2, efficiency: 0.976,
    warranty_years: 10, phase: 'SINGLE',
  },
  {
    brand: 'Growatt', model: 'SPF 5000 TL HVM', capacityKw: 5,
    maxInputVoltage: 800, mpptVoltageMin: 120, mpptVoltageMax: 700,
    maxInputCurrent: 25, mpptCount: 2, efficiency: 0.980,
    warranty_years: 10, phase: 'SINGLE',
  },
  // ── HUAWEI ─────────────────────────────────────────────────────────────────
  {
    brand: 'Huawei', model: 'SUN2000-5KTL-L1', capacityKw: 5,
    maxInputVoltage: 1000, mpptVoltageMin: 200, mpptVoltageMax: 950,
    maxInputCurrent: 27, mpptCount: 2, efficiency: 0.987,
    warranty_years: 10, phase: 'SINGLE',
  },
  {
    brand: 'Huawei', model: 'SUN2000-10KTL-M1', capacityKw: 10,
    maxInputVoltage: 1100, mpptVoltageMin: 200, mpptVoltageMax: 1050,
    maxInputCurrent: 30, mpptCount: 2, efficiency: 0.986,
    warranty_years: 10, phase: 'THREE',
  },
  // ── DELTA ──────────────────────────────────────────────────────────────────
  {
    brand: 'Delta', model: 'RPI M5A', capacityKw: 5,
    maxInputVoltage: 900, mpptVoltageMin: 200, mpptVoltageMax: 800,
    maxInputCurrent: 22, mpptCount: 2, efficiency: 0.978,
    warranty_years: 5, phase: 'SINGLE',
  },
  // ── GOODWE ─────────────────────────────────────────────────────────────────
  {
    brand: 'GoodWe', model: 'GW5000-EH', capacityKw: 5,
    maxInputVoltage: 1000, mpptVoltageMin: 160, mpptVoltageMax: 950,
    maxInputCurrent: 30, mpptCount: 2, efficiency: 0.982,
    warranty_years: 10, phase: 'SINGLE',
  },
  // ── FRONIUS ────────────────────────────────────────────────────────────────
  {
    brand: 'Fronius', model: 'Primo 6.0-1', capacityKw: 6,
    maxInputVoltage: 1000, mpptVoltageMin: 200, mpptVoltageMax: 800,
    maxInputCurrent: 25, mpptCount: 2, efficiency: 0.982,
    warranty_years: 7, phase: 'SINGLE',
  },
  // ── SOLAREDGE ──────────────────────────────────────────────────────────────
  {
    brand: 'SolarEdge', model: 'SE5000H', capacityKw: 5,
    maxInputVoltage: 480, mpptVoltageMin: 200, mpptVoltageMax: 480,
    maxInputCurrent: 15, mpptCount: 1, efficiency: 0.988,
    warranty_years: 12, phase: 'SINGLE',
  },
];

/**
 * Seeds the SolarInverter table in Prisma. Safe to call multiple times.
 */
export async function seedInverters(prisma: PrismaClient): Promise<void> {
  for (const inv of SOLAR_INVERTERS) {
    await (prisma as any).solarInverter.upsert({
      where: { brand_model: { brand: inv.brand, model: inv.model } },
      update: inv,
      create: inv,
    });
  }
  console.log(`✅ Seeded ${SOLAR_INVERTERS.length} solar inverters.`);
}
