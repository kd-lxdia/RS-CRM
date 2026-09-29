/**
 * Shading Analysis Web Worker
 * Uses Comlink to expose the annual shading analysis as a callable
 * from the main thread without blocking the UI.
 *
 * Usage in main thread:
 *   import { wrap } from 'comlink';
 *   const worker = new Worker(new URL('./shading.worker.ts', import.meta.url), { type: 'module' });
 *   const shadingApi = wrap<ShadingWorkerApi>(worker);
 *   const report = await shadingApi.runAnalysis(input);
 */

import { expose } from 'comlink';
import { runAnnualShadingAnalysis, getSunPosition, castPanelRowShadow, shadowFreeRowPitchM } from '../utils/shadow-engine';
import type { AnnualShadingInput, ShadingReport, SunPosition } from '../utils/shadow-engine';

export interface ShadingWorkerApi {
  runAnalysis(input: AnnualShadingInput): ShadingReport;
  getSunPosition(input: Parameters<typeof getSunPosition>[0]): SunPosition;
  castShadow(input: Parameters<typeof castPanelRowShadow>[0]): number;
  calcRowPitch(input: Parameters<typeof shadowFreeRowPitchM>[0]): number;
}

const api: ShadingWorkerApi = {
  runAnalysis: (input: AnnualShadingInput): ShadingReport => {
    return runAnnualShadingAnalysis(input);
  },

  getSunPosition: (input) => {
    return getSunPosition(input);
  },

  castShadow: (input) => {
    return castPanelRowShadow(input);
  },

  calcRowPitch: (input) => {
    return shadowFreeRowPitchM(input);
  },
};

expose(api);
