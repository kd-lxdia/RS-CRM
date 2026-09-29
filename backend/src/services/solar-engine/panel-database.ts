import { PrismaClient } from '@prisma/client';

export interface PanelData {
  brand: string;
  model: string;
  wattage: number;
  voc: number;
  vmpp: number;
  isc: number;
  impp: number;
  tempCoeffVoc: number;  // per °C, e.g. -0.0028 for -0.28%/°C
  efficiency: number;    // e.g. 0.215
  length_mm: number;
  width_mm: number;
  weight_kg: number;
  isDCR: boolean;
  warranty_years: number;
}

export const SOLAR_PANELS: PanelData[] = [
  // ── WAAREE ─────────────────────────────────────────────────────────────────
  {
    brand: 'Waaree', model: 'WS-440M', wattage: 440,
    voc: 49.5, vmpp: 41.5, isc: 10.8, impp: 10.3,
    tempCoeffVoc: -0.0028, efficiency: 0.215,
    length_mm: 2108, width_mm: 1048, weight_kg: 22.5,
    isDCR: true, warranty_years: 25,
  },
  {
    brand: 'Waaree', model: 'WS-540M', wattage: 540,
    voc: 49.9, vmpp: 42.0, isc: 13.7, impp: 12.9,
    tempCoeffVoc: -0.0028, efficiency: 0.209,
    length_mm: 2272, width_mm: 1134, weight_kg: 27.5,
    isDCR: true, warranty_years: 25,
  },
  {
    brand: 'Waaree', model: 'WS-580M', wattage: 580,
    voc: 51.5, vmpp: 43.2, isc: 14.2, impp: 13.4,
    tempCoeffVoc: -0.0028, efficiency: 0.221,
    length_mm: 2382, width_mm: 1134, weight_kg: 29.0,
    isDCR: true, warranty_years: 25,
  },
  // ── ADANI SOLAR ────────────────────────────────────────────────────────────
  {
    brand: 'Adani Solar', model: 'ADT440MH4', wattage: 440,
    voc: 49.2, vmpp: 41.2, isc: 10.9, impp: 10.4,
    tempCoeffVoc: -0.0029, efficiency: 0.213,
    length_mm: 2094, width_mm: 1038, weight_kg: 22.0,
    isDCR: true, warranty_years: 25,
  },
  {
    brand: 'Adani Solar', model: 'ADT545MH4', wattage: 545,
    voc: 50.1, vmpp: 42.5, isc: 13.8, impp: 13.0,
    tempCoeffVoc: -0.0028, efficiency: 0.211,
    length_mm: 2278, width_mm: 1134, weight_kg: 27.8,
    isDCR: true, warranty_years: 25,
  },
  // ── VIKRAM SOLAR ───────────────────────────────────────────────────────────
  {
    brand: 'Vikram Solar', model: 'ELDORA PRIMA 440', wattage: 440,
    voc: 49.4, vmpp: 41.4, isc: 10.9, impp: 10.3,
    tempCoeffVoc: -0.0028, efficiency: 0.214,
    length_mm: 2094, width_mm: 1038, weight_kg: 22.3,
    isDCR: true, warranty_years: 25,
  },
  {
    brand: 'Vikram Solar', model: 'SOMERA 540', wattage: 540,
    voc: 50.0, vmpp: 42.2, isc: 13.6, impp: 12.8,
    tempCoeffVoc: -0.0028, efficiency: 0.208,
    length_mm: 2260, width_mm: 1145, weight_kg: 27.5,
    isDCR: false, warranty_years: 25,
  },
  // ── TATA POWER SOLAR ───────────────────────────────────────────────────────
  {
    brand: 'Tata Power Solar', model: 'TP435M72/5BB', wattage: 435,
    voc: 48.8, vmpp: 40.9, isc: 10.8, impp: 10.2,
    tempCoeffVoc: -0.0029, efficiency: 0.211,
    length_mm: 2094, width_mm: 1038, weight_kg: 22.0,
    isDCR: true, warranty_years: 25,
  },
  {
    brand: 'Tata Power Solar', model: 'TP540M144', wattage: 540,
    voc: 50.2, vmpp: 42.3, isc: 13.65, impp: 12.88,
    tempCoeffVoc: -0.0027, efficiency: 0.209,
    length_mm: 2274, width_mm: 1134, weight_kg: 27.4,
    isDCR: true, warranty_years: 25,
  },
  // ── RENEWSYS ───────────────────────────────────────────────────────────────
  {
    brand: 'RenewSys', model: 'DESERV 415MH', wattage: 415,
    voc: 48.3, vmpp: 40.5, isc: 10.65, impp: 10.1,
    tempCoeffVoc: -0.0028, efficiency: 0.210,
    length_mm: 2094, width_mm: 998, weight_kg: 21.0,
    isDCR: true, warranty_years: 25,
  },
  // ── CANADIAN SOLAR ─────────────────────────────────────────────────────────
  {
    brand: 'Canadian Solar', model: 'HiKu7 CS7N-655MS', wattage: 655,
    voc: 54.4, vmpp: 46.1, isc: 14.81, impp: 14.21,
    tempCoeffVoc: -0.0025, efficiency: 0.222,
    length_mm: 2384, width_mm: 1303, weight_kg: 36.5,
    isDCR: false, warranty_years: 25,
  },
  {
    brand: 'Canadian Solar', model: 'HiKu6 CS6W-545MS', wattage: 545,
    voc: 49.8, vmpp: 42.0, isc: 13.82, impp: 12.99,
    tempCoeffVoc: -0.0027, efficiency: 0.211,
    length_mm: 2278, width_mm: 1134, weight_kg: 28.0,
    isDCR: false, warranty_years: 25,
  },
  // ── JINKO SOLAR ────────────────────────────────────────────────────────────
  {
    brand: 'JinkoSolar', model: 'Tiger Neo 580N-78HL4-(V)', wattage: 580,
    voc: 52.2, vmpp: 44.4, isc: 13.99, impp: 13.07,
    tempCoeffVoc: -0.0024, efficiency: 0.224,
    length_mm: 2465, width_mm: 1134, weight_kg: 31.0,
    isDCR: false, warranty_years: 25,
  },
  {
    brand: 'JinkoSolar', model: 'Tiger Neo 420N-54HL4', wattage: 420,
    voc: 38.6, vmpp: 32.3, isc: 13.72, impp: 13.01,
    tempCoeffVoc: -0.0026, efficiency: 0.215,
    length_mm: 1722, width_mm: 1134, weight_kg: 21.3,
    isDCR: false, warranty_years: 25,
  },
  // ── LONGI ──────────────────────────────────────────────────────────────────
  {
    brand: 'LONGi', model: 'Hi-MO 6 LR5-54HTH 430M', wattage: 430,
    voc: 41.9, vmpp: 35.2, isc: 13.18, impp: 12.23,
    tempCoeffVoc: -0.0026, efficiency: 0.220,
    length_mm: 1722, width_mm: 1134, weight_kg: 21.3,
    isDCR: false, warranty_years: 25,
  },
  {
    brand: 'LONGi', model: 'Hi-MO 7 LR5-72HGD 580M', wattage: 580,
    voc: 45.7, vmpp: 38.8, isc: 16.43, impp: 14.95,
    tempCoeffVoc: -0.0025, efficiency: 0.225,
    length_mm: 2278, width_mm: 1134, weight_kg: 28.0,
    isDCR: false, warranty_years: 25,
  },
];

/**
 * Seeds the SolarPanel table in Prisma.
 * Safe to call multiple times thanks to upsert.
 */
export async function seedPanels(prisma: PrismaClient): Promise<void> {
  for (const panel of SOLAR_PANELS) {
    await (prisma as any).solarPanel.upsert({
      where: { brand_model: { brand: panel.brand, model: panel.model } },
      update: panel,
      create: panel,
    });
  }
  console.log(`✅ Seeded ${SOLAR_PANELS.length} solar panels.`);
}
