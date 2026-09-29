// =============================================================================
// Solar Design Studio — Zustand Store with Undo/Redo
// =============================================================================

import { create } from 'zustand';
import type {
  ToolType, ViewMode, DesignRoof, DesignObstruction, DesignSubArray,
  DesignInverter, DesignDimension, DesignTextBlock, DesignData,
  DesignModule, DesignString, LayerVisibility, SolarAccessResult,
  ModuleSpec, InverterSpec, Point2D, ClipboardItem,
  BOMItem, MountingConfig,
} from './types';
import { uid } from '../utils/geometry';
import { generateStructure, resolveMountingConfig } from '../engine/MountingStructureEngine';

// ─── Module & Inverter Databases ─────────────────────────────────────────────

export const MODULE_DATABASE: ModuleSpec[] = [
  { id: 'ws440', brand: 'Waaree', model: 'WS-440M', wattage: 440, lengthMm: 2108, widthMm: 1048, voc: 49.5, isc: 10.8, vmpp: 41.5, impp: 10.3, efficiency: 0.215, tempCoeffVoc: -0.0028, weightKg: 22.5 },
  { id: 'ws540', brand: 'Waaree', model: 'WS-540M', wattage: 540, lengthMm: 2272, widthMm: 1134, voc: 49.9, isc: 13.7, vmpp: 42.0, impp: 12.9, efficiency: 0.209, tempCoeffVoc: -0.0028, weightKg: 27.5 },
  { id: 'ws580', brand: 'Waaree', model: 'WS-580M', wattage: 580, lengthMm: 2382, widthMm: 1134, voc: 51.5, isc: 14.2, vmpp: 43.2, impp: 13.4, efficiency: 0.221, tempCoeffVoc: -0.0028, weightKg: 29.0 },
  { id: 'adt440', brand: 'Adani Solar', model: 'ADT440MH4', wattage: 440, lengthMm: 2094, widthMm: 1038, voc: 49.2, isc: 10.9, vmpp: 41.2, impp: 10.4, efficiency: 0.213, tempCoeffVoc: -0.0029, weightKg: 22.0 },
  { id: 'adt545', brand: 'Adani Solar', model: 'ADT545MH4', wattage: 545, lengthMm: 2278, widthMm: 1134, voc: 50.1, isc: 13.8, vmpp: 42.5, impp: 13.0, efficiency: 0.211, tempCoeffVoc: -0.0028, weightKg: 27.8 },
  { id: 'tp435', brand: 'Tata Power Solar', model: 'TP435M72', wattage: 435, lengthMm: 2094, widthMm: 1038, voc: 48.8, isc: 10.8, vmpp: 40.9, impp: 10.2, efficiency: 0.211, tempCoeffVoc: -0.0029, weightKg: 22.0 },
  { id: 'tp540', brand: 'Tata Power Solar', model: 'TP540M144', wattage: 540, lengthMm: 2274, widthMm: 1134, voc: 50.2, isc: 13.65, vmpp: 42.3, impp: 12.88, efficiency: 0.209, tempCoeffVoc: -0.0027, weightKg: 27.4 },
  { id: 'jk580', brand: 'JinkoSolar', model: 'Tiger Neo 580N', wattage: 580, lengthMm: 2465, widthMm: 1134, voc: 52.2, isc: 13.99, vmpp: 44.4, impp: 13.07, efficiency: 0.224, tempCoeffVoc: -0.0024, weightKg: 31.0 },
  { id: 'lo430', brand: 'LONGi', model: 'Hi-MO 6 430M', wattage: 430, lengthMm: 1722, widthMm: 1134, voc: 41.9, isc: 13.18, vmpp: 35.2, impp: 12.23, efficiency: 0.220, tempCoeffVoc: -0.0026, weightKg: 21.3 },
  { id: 'lo580', brand: 'LONGi', model: 'Hi-MO 7 580M', wattage: 580, lengthMm: 2278, widthMm: 1134, voc: 45.7, isc: 16.43, vmpp: 38.8, impp: 14.95, efficiency: 0.225, tempCoeffVoc: -0.0025, weightKg: 28.0 },
];

export const INVERTER_DATABASE: InverterSpec[] = [
  { id: 'hv3', brand: 'Havells', model: 'Solero 3kW', capacityKw: 3, maxInputVoltage: 600, mpptCount: 2, minString: 5, maxString: 12, efficiency: 0.975, phase: 'Single' },
  { id: 'hv5', brand: 'Havells', model: 'Solero 5kW', capacityKw: 5, maxInputVoltage: 800, mpptCount: 2, minString: 7, maxString: 16, efficiency: 0.974, phase: 'Single' },
  { id: 'sl10', brand: 'Solis', model: 'S5-GR3P10K', capacityKw: 10, maxInputVoltage: 1000, mpptCount: 3, minString: 8, maxString: 20, efficiency: 0.980, phase: 'Three' },
  { id: 'gr10', brand: 'Growatt', model: 'MID 10KTL3-X', capacityKw: 10, maxInputVoltage: 1000, mpptCount: 4, minString: 7, maxString: 23, efficiency: 0.984, phase: 'Three' },
  { id: 'hw10', brand: 'Huawei', model: 'SUN2000-10KTL', capacityKw: 10, maxInputVoltage: 1100, mpptCount: 4, minString: 8, maxString: 22, efficiency: 0.985, phase: 'Three' },
  { id: 'gw5', brand: 'GoodWe', model: 'GW5048-EM', capacityKw: 5, maxInputVoltage: 600, mpptCount: 2, minString: 6, maxString: 14, efficiency: 0.977, phase: 'Single' },
  { id: 'fr10', brand: 'Fronius', model: 'Symo 10.0-3', capacityKw: 10, maxInputVoltage: 1000, mpptCount: 3, minString: 7, maxString: 20, efficiency: 0.980, phase: 'Three' },
  { id: 'dl10', brand: 'Delta', model: 'M10A 3PH10K', capacityKw: 10, maxInputVoltage: 1000, mpptCount: 4, minString: 8, maxString: 22, efficiency: 0.980, phase: 'Three' },
];

// ─── Store State Interface ───────────────────────────────────────────────────

interface DesignStoreState {
  // Design data
  roofs: DesignRoof[];
  obstructions: DesignObstruction[];
  subArrays: DesignSubArray[];
  inverters: DesignInverter[];
  dimensions: DesignDimension[];
  textBlocks: DesignTextBlock[];
  solarAccess: SolarAccessResult;
  bomResults: Record<string, BOMItem[]>;

  // UI state
  activeTool: ToolType;
  viewMode: ViewMode;
  selectedIds: string[];
  selectedType: string | null;
  drawingVertices: Point2D[];
  isDrawing: boolean;
  pxPerMeter: number;
  canvasOffset: Point2D;
  canvasScale: number;
  latitude: number;

  // Layers
  layers: LayerVisibility;

  // Clipboard
  clipboard: ClipboardItem[];
  lastPasteOffset: Point2D | null;
  pasteMode: 'none' | 'mirror' | 'repeat';

  // Undo/Redo
  history: DesignData[];
  historyIndex: number;

  // Auto-save
  isDirty: boolean;
  lastSaved: string | null;

  // Solar access
  solarAccessRun: boolean;
  showIrradianceMap: boolean;

  // Location data
  locationData: { address: string; lat: number; lng: number; elevation: number; imageUrl: string } | null;
  projectOrigin: { lat: number; lng: number; alt: number } | null;

  // Sun path simulation
  sunSimulation: {
    enabled: boolean;
    day: number;
    month: number;
    hour: number;
    minute: number;
    isPlaying: boolean;
    playMode: 'hour' | 'month';
    sunAzimuth: number;
    sunElevation: number;
    shadowPolygons: any[];
  };

  // Irradiance map
  irradianceMap: {
    enabled: boolean;
    fluxData: Float32Array | null;
    minFlux: number;
    maxFlux: number;
    moduleFluxMap: Map<string, number>;
    legendMin: number;
    legendMax: number;
  };

  // Energy results
  energyResults: {
    calculated: boolean;
    lastCalculatedAt: Date | null;
    annualGenerationMWh: number;
    specGenKwhPerKwp: number;
    performanceRatio: number;
    energyOffsetPct: number;
    systemKWp: number;
    monthlyBreakdown: number[];
  };

  // Canvas UI
  canvasUI: {
    mapSource: 'satellite' | 'hybrid' | 'roadmap' | 'osm';
    threeDSource: 'google-solar-3d' | 'flat-2d';
    dualMapEnabled: boolean;
    cursorX: number;
    cursorY: number;
    cursorZ: number;
    compassBearing: number;
  };

  // Actions
  setActiveTool: (tool: ToolType) => void;
  setViewMode: (mode: ViewMode) => void;
  selectObjects: (ids: string[], type: string | null) => void;
  clearSelection: () => void;

  // Drawing
  addDrawingVertex: (point: Point2D) => void;
  clearDrawing: () => void;
  setIsDrawing: (v: boolean) => void;

  // Canvas
  setCanvasScale: (s: number) => void;
  setCanvasOffset: (o: Point2D) => void;
  setPxPerMeter: (v: number) => void;

  // Roofs
  addRoof: (roof: DesignRoof) => void;
  updateRoof: (id: string, updates: Partial<DesignRoof>) => void;
  deleteRoof: (id: string) => void;

  // Obstructions
  addObstruction: (obs: DesignObstruction) => void;
  updateObstruction: (id: string, updates: Partial<DesignObstruction>) => void;
  deleteObstruction: (id: string) => void;

  // Sub-arrays
  addSubArray: (sa: DesignSubArray) => void;
  updateSubArray: (id: string, updates: Partial<DesignSubArray>) => void;
  deleteSubArray: (id: string) => void;
  setSubArrayMounting: (id: string, config: Partial<MountingConfig>) => void;
  updateBOM: (subArrayId: string) => void;

  // Modules
  addModuleToSubArray: (subArrayId: string, mod: DesignModule) => void;
  deleteModule: (subArrayId: string, moduleId: string) => void;
  deleteModules: (moduleIds: string[]) => void;

  // Inverters
  addInverter: (inv: DesignInverter) => void;
  updateInverter: (id: string, updates: Partial<DesignInverter>) => void;
  deleteInverter: (id: string) => void;
  addStringToInverter: (inverterId: string, str: DesignString) => void;

  // Dimensions
  addDimension: (dim: DesignDimension) => void;
  deleteDimension: (id: string) => void;

  // Text blocks
  addTextBlock: (tb: DesignTextBlock) => void;
  updateTextBlock: (id: string, updates: Partial<DesignTextBlock>) => void;
  deleteTextBlock: (id: string) => void;

  // Layers
  setLayerVisibility: (layer: keyof LayerVisibility, visible: boolean) => void;

  // Solar access
  setSolarAccess: (result: SolarAccessResult) => void;
  setSolarAccessRun: (v: boolean) => void;
  setShowIrradianceMap: (v: boolean) => void;

  // Location
  setLocationData: (data: { address: string; lat: number; lng: number; elevation: number; imageUrl: string } | null) => void;
  setProjectOrigin: (origin: { lat: number; lng: number; alt: number } | null) => void;

  // Sun simulation
  setSunSimulation: (updates: Partial<DesignStoreState['sunSimulation']>) => void;
  toggleSunSimulation: () => void;
  updateSunPosition: () => void;

  // Irradiance map
  setIrradianceMap: (updates: Partial<DesignStoreState['irradianceMap']>) => void;
  toggleIrradianceMap: () => void;

  // Energy results
  setEnergyResults: (results: Partial<DesignStoreState['energyResults']>) => void;

  // Canvas UI
  setCanvasUI: (updates: Partial<DesignStoreState['canvasUI']>) => void;
  updateCursorPosition: (x: number, y: number, z: number) => void;

  // Selection & delete
  deleteSelected: () => void;

  // Clipboard
  copySelected: () => void;
  paste: () => void;
  setPasteMode: (mode: 'none' | 'mirror' | 'repeat') => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Save/Load
  saveDesign: () => void;
  loadDesign: (designId: string) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
}

// ─── Helper to snapshot design data ──────────────────────────────────────────

function getDesignData(state: DesignStoreState): DesignData {
  return {
    roofs: state.roofs,
    obstructions: state.obstructions,
    subArrays: state.subArrays,
    inverters: state.inverters,
    dimensions: state.dimensions,
    textBlocks: state.textBlocks,
    solarAccess: state.solarAccess,
  };
}

// ─── Create Store ────────────────────────────────────────────────────────────

export const useDesignStore = create<DesignStoreState>((set, get) => ({
  // Initial design data
  roofs: [],
  obstructions: [],
  subArrays: [],
  inverters: [],
  dimensions: [],
  textBlocks: [],
  solarAccess: {},
  bomResults: {},

  // UI state
  activeTool: 'select',
  viewMode: '2d',
  selectedIds: [],
  selectedType: null,
  drawingVertices: [],
  isDrawing: false,
  pxPerMeter: 20, // default: 20px = 1m
  canvasOffset: { x: 0, y: 0 },
  canvasScale: 1,
  latitude: 28.6, // Delhi default

  // Layers
  layers: {
    arc: true,
    stringing: true,
    hCenter: false,
    setbackLines: true,
    obstructionLabels: true,
  },

  // Clipboard
  clipboard: [],
  lastPasteOffset: null,
  pasteMode: 'none',

  // Undo/Redo
  history: [],
  historyIndex: -1,

  // Auto-save
  isDirty: false,
  lastSaved: null,

  // Solar access
  solarAccessRun: false,
  showIrradianceMap: false,

  // Location data
  locationData: null,
  projectOrigin: null,

  // Sun path simulation
  sunSimulation: {
    enabled: false,
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    hour: 12,
    minute: 0,
    isPlaying: false,
    playMode: 'hour',
    sunAzimuth: 180,
    sunElevation: 45,
    shadowPolygons: [],
  },

  // Irradiance map
  irradianceMap: {
    enabled: false,
    fluxData: null,
    minFlux: 0,
    maxFlux: 0,
    moduleFluxMap: new Map(),
    legendMin: 0.7,
    legendMax: 1.0,
  },

  // Energy results
  energyResults: {
    calculated: false,
    lastCalculatedAt: null,
    annualGenerationMWh: 0,
    specGenKwhPerKwp: 0,
    performanceRatio: 0,
    energyOffsetPct: 0,
    systemKWp: 0,
    monthlyBreakdown: Array(12).fill(0),
  },

  // Canvas UI
  canvasUI: {
    mapSource: 'satellite',
    threeDSource: 'flat-2d',
    dualMapEnabled: false,
    cursorX: 0,
    cursorY: 0,
    cursorZ: 0,
    compassBearing: 0,
  },

  // ─── Tool & View ─────────────────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool, drawingVertices: [], isDrawing: false }),
  setViewMode: (mode) => set({ viewMode: mode }),

  selectObjects: (ids, type) => set({ selectedIds: ids, selectedType: type }),
  clearSelection: () => set({ selectedIds: [], selectedType: null }),

  // ─── Drawing ─────────────────────────────────────────────────────────────

  addDrawingVertex: (point) => set(s => ({ drawingVertices: [...s.drawingVertices, point] })),
  clearDrawing: () => set({ drawingVertices: [], isDrawing: false }),
  setIsDrawing: (v) => set({ isDrawing: v }),

  // ─── Canvas ──────────────────────────────────────────────────────────────

  setCanvasScale: (s) => set({ canvasScale: s }),
  setCanvasOffset: (o) => set({ canvasOffset: o }),
  setPxPerMeter: (v) => set({ pxPerMeter: v }),

  // ─── Roofs ───────────────────────────────────────────────────────────────

  addRoof: (roof) => {
    get().pushHistory();
    set(s => ({ roofs: [...s.roofs, roof], isDirty: true }));
  },
  updateRoof: (id, updates) => {
    get().pushHistory();
    set(s => ({
      roofs: s.roofs.map(r => r.id === id ? { ...r, ...updates } : r),
      isDirty: true,
    }));
  },
  deleteRoof: (id) => {
    get().pushHistory();
    set(s => ({
      roofs: s.roofs.filter(r => r.id !== id),
      obstructions: s.obstructions.filter(o => o.roofId !== id),
      subArrays: s.subArrays.filter(sa => sa.roofId !== id),
      isDirty: true,
    }));
  },

  // ─── Obstructions ────────────────────────────────────────────────────────

  addObstruction: (obs) => {
    get().pushHistory();
    set(s => ({ obstructions: [...s.obstructions, obs], isDirty: true }));
  },
  updateObstruction: (id, updates) => {
    get().pushHistory();
    set(s => ({
      obstructions: s.obstructions.map(o => o.id === id ? { ...o, ...updates } : o),
      isDirty: true,
    }));
  },
  deleteObstruction: (id) => {
    get().pushHistory();
    set(s => ({
      obstructions: s.obstructions.filter(o => o.id !== id),
      isDirty: true,
    }));
  },

  // ─── Sub-arrays ──────────────────────────────────────────────────────────

  addSubArray: (sa) => {
    get().pushHistory();
    set(s => ({ subArrays: [...s.subArrays, sa], isDirty: true }));
    get().updateBOM(sa.id);
  },
  updateSubArray: (id, updates) => {
    get().pushHistory();
    set(s => ({
      subArrays: s.subArrays.map(sa => sa.id === id ? { ...sa, ...updates } : sa),
      isDirty: true,
    }));
    get().updateBOM(id);
  },
  deleteSubArray: (id) => {
    get().pushHistory();
    set(s => ({
      subArrays: s.subArrays.filter(sa => sa.id !== id),
      bomResults: Object.fromEntries(Object.entries(s.bomResults).filter(([subArrayId]) => subArrayId !== id)),
      isDirty: true,
    }));
  },
  setSubArrayMounting: (id, config) => {
    get().pushHistory();
    set(s => ({
      subArrays: s.subArrays.map(sa => sa.id === id
        ? { ...sa, mountingConfig: { ...resolveMountingConfig(sa), ...config } }
        : sa),
      isDirty: true,
    }));
    get().updateBOM(id);
  },
  updateBOM: (subArrayId) => {
    const s = get();
    const subArray = s.subArrays.find(sa => sa.id === subArrayId);
    if (!subArray) return;
    const moduleSpec = MODULE_DATABASE.find(m => m.id === subArray.moduleSpecId);
    if (!moduleSpec) return;
    const roof = s.roofs.find(r => r.id === subArray.roofId);
    const baseElevationM = roof ? (roof.baseHeight || 0) + (roof.height || 3) + 0.2 : 0;
    const assembly = generateStructure({ subArray, moduleSpec, pxPerMeter: s.pxPerMeter, baseElevationM });
    set(prev => ({
      bomResults: { ...prev.bomResults, [subArrayId]: assembly.bom },
    }));
  },

  // ─── Modules ─────────────────────────────────────────────────────────────

  addModuleToSubArray: (subArrayId, mod) => {
    get().pushHistory();
    set(s => ({
      subArrays: s.subArrays.map(sa =>
        sa.id === subArrayId
          ? { ...sa, modules: [...sa.modules, mod] }
          : sa
      ),
      isDirty: true,
    }));
    get().updateBOM(subArrayId);
  },
  deleteModule: (subArrayId, moduleId) => {
    get().pushHistory();
    set(s => ({
      subArrays: s.subArrays.map(sa =>
        sa.id === subArrayId
          ? { ...sa, modules: sa.modules.filter(m => m.id !== moduleId) }
          : sa
      ),
      isDirty: true,
    }));
    get().updateBOM(subArrayId);
  },
  deleteModules: (moduleIds) => {
    get().pushHistory();
    const idSet = new Set(moduleIds);
    set(s => ({
      subArrays: s.subArrays.map(sa => ({
        ...sa,
        modules: sa.modules.filter(m => !idSet.has(m.id)),
      })).filter(sa => sa.modules.length > 0),
      isDirty: true,
    }));
  },

  // ─── Inverters ───────────────────────────────────────────────────────────

  addInverter: (inv) => {
    get().pushHistory();
    set(s => ({ inverters: [...s.inverters, inv], isDirty: true }));
  },
  updateInverter: (id, updates) => {
    get().pushHistory();
    set(s => ({
      inverters: s.inverters.map(i => i.id === id ? { ...i, ...updates } : i),
      isDirty: true,
    }));
  },
  deleteInverter: (id) => {
    get().pushHistory();
    set(s => ({
      inverters: s.inverters.filter(i => i.id !== id),
      isDirty: true,
    }));
  },
  addStringToInverter: (inverterId, str) => {
    get().pushHistory();
    set(s => ({
      inverters: s.inverters.map(i =>
        i.id === inverterId
          ? { ...i, strings: [...i.strings, str] }
          : i
      ),
      isDirty: true,
    }));
  },

  // ─── Dimensions ──────────────────────────────────────────────────────────

  addDimension: (dim) => {
    get().pushHistory();
    set(s => ({ dimensions: [...s.dimensions, dim], isDirty: true }));
  },
  deleteDimension: (id) => {
    get().pushHistory();
    set(s => ({
      dimensions: s.dimensions.filter(d => d.id !== id),
      isDirty: true,
    }));
  },

  // ─── Text blocks ─────────────────────────────────────────────────────────

  addTextBlock: (tb) => {
    get().pushHistory();
    set(s => ({ textBlocks: [...s.textBlocks, tb], isDirty: true }));
  },
  updateTextBlock: (id, updates) => {
    get().pushHistory();
    set(s => ({
      textBlocks: s.textBlocks.map(tb => tb.id === id ? { ...tb, ...updates } : tb),
      isDirty: true,
    }));
  },
  deleteTextBlock: (id) => {
    get().pushHistory();
    set(s => ({
      textBlocks: s.textBlocks.filter(tb => tb.id !== id),
      isDirty: true,
    }));
  },

  // ─── Layers ──────────────────────────────────────────────────────────────

  setLayerVisibility: (layer, visible) => set(s => ({
    layers: { ...s.layers, [layer]: visible },
  })),

  // ─── Solar access ────────────────────────────────────────────────────────

  setSolarAccess: (result) => set({ solarAccess: result }),
  setSolarAccessRun: (v) => set({ solarAccessRun: v }),
  setShowIrradianceMap: (v) => set(s => ({
    showIrradianceMap: v,
    irradianceMap: { ...s.irradianceMap, enabled: v },
  })),

  // ─── Location ────────────────────────────────────────────────────────────

  setLocationData: (data) => set({
    locationData: data,
    projectOrigin: data ? { lat: data.lat, lng: data.lng, alt: data.elevation } : null
  }),
  setProjectOrigin: (origin) => set({ projectOrigin: origin }),

  // ─── Sun simulation ──────────────────────────────────────────────────────

  setSunSimulation: (updates) => set(s => ({
    sunSimulation: { ...s.sunSimulation, ...updates },
  })),

  toggleSunSimulation: () => set(s => ({
    sunSimulation: { ...s.sunSimulation, enabled: !s.sunSimulation.enabled },
  })),

  updateSunPosition: () => {
    const s = get();
    if (!s.locationData) return;

    // Import will be done in component
    // This is a placeholder - actual calculation happens in component
    set(s => ({
      sunSimulation: {
        ...s.sunSimulation,
        // sunAzimuth and sunElevation will be updated by component
      },
    }));
  },

  // ─── Irradiance map ──────────────────────────────────────────────────────

  setIrradianceMap: (updates) => set(s => {
    const irradianceMap = { ...s.irradianceMap, ...updates };
    return {
      irradianceMap,
      showIrradianceMap: updates.enabled ?? s.showIrradianceMap,
    };
  }),

  toggleIrradianceMap: () => set(s => ({
    showIrradianceMap: !s.irradianceMap.enabled,
    irradianceMap: { ...s.irradianceMap, enabled: !s.irradianceMap.enabled },
  })),

  // ─── Energy results ──────────────────────────────────────────────────────

  setEnergyResults: (results) => set(s => ({
    energyResults: { ...s.energyResults, ...results },
  })),

  // ─── Canvas UI ───────────────────────────────────────────────────────────

  setCanvasUI: (updates) => set(s => ({
    canvasUI: { ...s.canvasUI, ...updates },
  })),

  updateCursorPosition: (x, y, z) => set(s => ({
    canvasUI: { ...s.canvasUI, cursorX: x, cursorY: y, cursorZ: z },
  })),

  // ─── Delete selected ──────────────────────────────────────────────────────

  deleteSelected: () => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    get().pushHistory();

    const idSet = new Set(s.selectedIds);

    set(prev => ({
      roofs: prev.roofs.filter(r => !idSet.has(r.id)),
      obstructions: prev.obstructions.filter(o => !idSet.has(o.id)),
      subArrays: prev.subArrays.map(sa => ({
        ...sa,
        modules: sa.modules.filter(m => !idSet.has(m.id)),
      })).filter(sa => sa.modules.length > 0 || !idSet.has(sa.id)),
      inverters: prev.inverters.filter(i => !idSet.has(i.id)),
      dimensions: prev.dimensions.filter(d => !idSet.has(d.id)),
      textBlocks: prev.textBlocks.filter(tb => !idSet.has(tb.id)),
      selectedIds: [],
      selectedType: null,
      isDirty: true,
    }));
  },

  // ─── Clipboard ───────────────────────────────────────────────────────────

  copySelected: () => {
    const s = get();
    if (s.selectedIds.length === 0) return;
    const items: ClipboardItem[] = [];

    for (const id of s.selectedIds) {
      // Check modules first
      for (const sa of s.subArrays) {
        const mod = sa.modules.find(m => m.id === id);
        if (mod) {
          items.push({ type: 'module', data: { ...mod, subArrayId: sa.id }, originalPosition: { x: mod.x, y: mod.y } });
        }
      }
      // Obstructions
      const obs = s.obstructions.find(o => o.id === id);
      if (obs) {
        items.push({ type: 'obstruction', data: { ...obs }, originalPosition: obs.center || (obs.vertices[0] ?? { x: 0, y: 0 }) });
      }
      // Text blocks
      const tb = s.textBlocks.find(t => t.id === id);
      if (tb) {
        items.push({ type: 'textBlock', data: { ...tb }, originalPosition: { x: tb.x, y: tb.y } });
      }
    }

    set({ clipboard: items });
  },

  paste: () => {
    const s = get();
    if (s.clipboard.length === 0) return;
    get().pushHistory();

    const offset = 20;
    for (const item of s.clipboard) {
      if (item.type === 'module') {
        const newMod: DesignModule = {
          ...item.data,
          id: uid(),
          x: item.data.x + offset,
          y: item.data.y + offset,
        };
        const sa = s.subArrays.find(sa => sa.id === item.data.subArrayId);
        if (sa) {
          get().addModuleToSubArray(sa.id, newMod);
        }
      }
      if (item.type === 'textBlock') {
        get().addTextBlock({
          ...item.data,
          id: uid(),
          x: item.data.x + offset,
          y: item.data.y + offset,
        });
      }
      if (item.type === 'obstruction') {
        get().addObstruction({
          ...item.data,
          id: uid(),
          vertices: item.data.vertices.map((v: Point2D) => ({ x: v.x + offset, y: v.y + offset })),
          center: item.data.center ? { x: item.data.center.x + offset, y: item.data.center.y + offset } : undefined,
        });
      }
    }

    set({ lastPasteOffset: { x: offset, y: offset }, isDirty: true });
  },

  setPasteMode: (mode) => set({ pasteMode: mode }),

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  pushHistory: () => {
    const s = get();
    const snapshot = JSON.parse(JSON.stringify(getDesignData(s)));
    const newHistory = s.history.slice(0, s.historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const s = get();
    if (s.historyIndex < 0) return;
    const snapshot = s.history[s.historyIndex];
    set({
      ...snapshot,
      historyIndex: s.historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const snapshot = s.history[s.historyIndex + 1];
    set({
      ...snapshot,
      historyIndex: s.historyIndex + 1,
      isDirty: true,
    });
  },

  // ─── Save / Load ─────────────────────────────────────────────────────────

  saveDesign: () => {
    const s = get();
    const data = getDesignData(s);
    const key = 'solar_design_' + (window.location.pathname.split('/').pop() || 'default');
    localStorage.setItem(key, JSON.stringify(data));
    set({ isDirty: false, lastSaved: new Date().toISOString() });
  },

  loadDesign: (designId) => {
    const key = 'solar_design_' + designId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const data: DesignData = JSON.parse(raw);
      set({
        ...data,
        isDirty: false,
        history: [],
        historyIndex: -1,
      });
    } catch (e) {
      console.error('Failed to load design', e);
    }
  },

  exportJSON: () => {
    const s = get();
    return JSON.stringify(getDesignData(s), null, 2);
  },

  importJSON: (json) => {
    try {
      const data: DesignData = JSON.parse(json);
      get().pushHistory();
      set({ ...data, isDirty: true });
    } catch (e) {
      console.error('Failed to import JSON', e);
    }
  },
}));
