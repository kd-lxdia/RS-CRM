// =============================================================================
// Solar Design Studio — Type Definitions
// =============================================================================

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface Point2D { x: number; y: number; }

// ─── Tool Types ──────────────────────────────────────────────────────────────

export type ToolType =
  | 'select'
  | 'model_flat' | 'model_pitch' | 'model_draw'
  | 'obstruction_cylinder' | 'obstruction_polygon' | 'obstruction_rectangle'
  | 'obstruction_safety_line' | 'obstruction_property_line'
  | 'obstruction_handrail' | 'obstruction_walkway' | 'obstruction_tree'
  | 'module_add' | 'module_delete' | 'module_toggle'
  | 'component_inverter'
  | 'dimension'
  | 'lasso'
  | 'text_block'
  | 'irradiance_map' | 'solar_access'
  | 'add_table';

export type ViewMode = '2d' | '3d' | 'sld';
export type TemplateType = 'tilted_mount' | 'roof_mount' | 'ew_tracking';
export type StructureType = 'default' | 'pergola' | 'tata_power' | 'relay_rack' | 'textile_2500';
export type Orientation = 'portrait' | 'landscape';
export type TreeModelType = 'spruce' | 'pine' | 'apple' | 'oak' | 'palm' | 'conifer';

// ─── Mounting Structure System ────────────────────────────────────────────────

export type MountingStructureType =
  | 'flush_roof'
  | 'elevated_roof'
  | 'ballasted_roof'
  | 'fixed_tilt_single'
  | 'fixed_tilt_double'
  | 'east_west'
  | 'sat_single_axis';

export type FoundationType =
  | 'rcc_footing' | 'pile' | 'screw_pile' | 'ballast'
  | 'rock_anchor' | 'l_foot' | 'roof_hook';

export type StructuralMaterial = 'steel_galv' | 'aluminum' | 'stainless' | 'concrete';

export interface MountingConfig {
  structureType: MountingStructureType;
  tilt: number;
  azimuth: number;
  groundClearanceM: number;
  legSpacingM: number;
  tableWidthM: number;
  tableHeightM: number;
  foundationType: FoundationType;
  foundationDepthM: number;
  columnSectionMm: number;
  railSectionW: number;
  railSectionH: number;
  bracingEnabled: boolean;
  material: StructuralMaterial;
  windZone: 'I' | 'II' | 'III' | 'IV';
  snowLoadKPa: number;
  ewTiltDeg?: number;
  trackerRotationDeg?: number;
  driveAisleWidthM?: number;
}

export const DEFAULT_MOUNTING_CONFIGS: Record<MountingStructureType, Partial<MountingConfig>> = {
  flush_roof:        { groundClearanceM: 0.05, columnSectionMm: 40,  railSectionW: 40, railSectionH: 25, foundationType: 'l_foot',    foundationDepthM: 0,   legSpacingM: 1.2, bracingEnabled: false },
  elevated_roof:     { groundClearanceM: 0.20, columnSectionMm: 50,  railSectionW: 40, railSectionH: 25, foundationType: 'roof_hook', foundationDepthM: 0,   legSpacingM: 1.2, bracingEnabled: false },
  ballasted_roof:    { groundClearanceM: 0.10, columnSectionMm: 50,  railSectionW: 40, railSectionH: 30, foundationType: 'ballast',   foundationDepthM: 0,   legSpacingM: 1.5, bracingEnabled: false },
  fixed_tilt_single: { groundClearanceM: 0.80, columnSectionMm: 100, railSectionW: 60, railSectionH: 40, foundationType: 'pile',      foundationDepthM: 1.5, legSpacingM: 4.0, bracingEnabled: true  },
  fixed_tilt_double: { groundClearanceM: 0.60, columnSectionMm: 100, railSectionW: 60, railSectionH: 40, foundationType: 'pile',      foundationDepthM: 1.5, legSpacingM: 4.0, bracingEnabled: true  },
  east_west:         { groundClearanceM: 0.50, columnSectionMm: 80,  railSectionW: 50, railSectionH: 35, foundationType: 'pile',      foundationDepthM: 1.2, legSpacingM: 3.0, bracingEnabled: false },
  sat_single_axis:   { groundClearanceM: 1.20, columnSectionMm: 150, railSectionW: 80, railSectionH: 60, foundationType: 'screw_pile',foundationDepthM: 2.0, legSpacingM: 5.0, bracingEnabled: false, trackerRotationDeg: 0 },
};

// ─── BOM ─────────────────────────────────────────────────────────────────────

export interface BOMItem {
  category: 'structural' | 'rails' | 'fasteners' | 'foundation' | 'electrical';
  description: string;
  unit: 'kg' | 'm' | 'pcs' | 'm²' | 'm³';
  quantity: number;
  unitWeightKg?: number;
  totalWeightKg?: number;
  notes?: string;
}

// ─── Structural Member Descriptor (output of MountingStructureEngine) ────────

export type StructuralMemberType =
  | 'column' | 'rail' | 'rafter' | 'purlin' | 'brace'
  | 'torque_tube' | 'clamp' | 'foundation' | 'ballast'
  | 'l_foot' | 'bearing' | 'drive_unit' | 'crossbeam';

export interface StructuralMember {
  type: StructuralMemberType;
  start: [number, number, number]; // [East m, Up m, North m]
  end:   [number, number, number];
  sectionW: number; // meters
  sectionH: number; // meters
  material: StructuralMaterial;
  metadata?: Record<string, any>;
}

export interface FoundationDescriptor {
  type: FoundationType;
  positionX: number; // East m
  positionZ: number; // North m
  elevationM?: number; // Up m
  depthM: number;
  widthM: number;
}

export interface StructuralAssembly {
  members: StructuralMember[];
  foundations: FoundationDescriptor[];
  bom: BOMItem[];
}

// ─── Roof ────────────────────────────────────────────────────────────────────

export interface DesignRoof {
  id: string;
  name: string;
  vertices: Point2D[];
  height: number;
  parapetHeight: number;
  tilt: number;
  azimuth: number;
  setbacks: { n: number; e: number; s: number; w: number };
  flashType: boolean;
  baseHeight: number;
  templateType: TemplateType;
  structureType: StructureType;
  color: string;
}

// ─── Obstructions ────────────────────────────────────────────────────────────

export type ObstructionType =
  | 'cylinder' | 'polygon' | 'rectangle'
  | 'safety_line' | 'property_line'
  | 'handrail' | 'walkway' | 'tree';

export interface DesignObstruction {
  id: string;
  type: ObstructionType;
  roofId: string;
  vertices: Point2D[];
  center?: Point2D;
  radius?: number;
  height: number;
  width?: number;
  trunkHeight?: number;
  crownHeight?: number;
  crownRadius?: number;
  treeModel?: TreeModelType;
}

// ─── Modules / Sub-Arrays ────────────────────────────────────────────────────

export interface DesignModule {
  id: string;
  subArrayId: string;
  x: number;
  y: number;
  row: number;
  col: number;
  solarAccess?: number;
}

export interface ModuleSpec {
  id: string;
  brand: string;
  model: string;
  wattage: number;
  lengthMm: number;
  widthMm: number;
  voc: number;
  isc: number;
  vmpp: number;
  impp: number;
  efficiency: number;
  tempCoeffVoc: number;
  weightKg: number;
}

export interface DesignSubArray {
  id: string;
  roofId: string;
  moduleSpecId: string;
  modules: DesignModule[];
  tilt: number;
  azimuth: number;
  mountHeight: number;
  rowSpacing: number;
  rowSpacingMode: 'auto' | 'manual';
  orientation: Orientation;
  tableRows: number;
  tableCols: number;
  vSpacing: number;
  hSpacing: number;
  tableSpacing: number;
  templateType: TemplateType;
  structureType: StructureType;
  mountingConfig?: MountingConfig; // NEW — optional for backward compat
}

// ─── Inverters & Strings ─────────────────────────────────────────────────────

export interface InverterSpec {
  id: string;
  brand: string;
  model: string;
  capacityKw: number;
  maxInputVoltage: number;
  mpptCount: number;
  minString: number;
  maxString: number;
  efficiency: number;
  phase: string;
}

export interface DesignString {
  id: string;
  inverterPlacementId: string;
  mpptIndex: number;
  moduleIds: string[];
  wireSize?: number;
}

export interface DesignInverter {
  id: string;
  inverterSpecId: string;
  x: number;
  y: number;
  quantity: number;
  strings: DesignString[];
}

// ─── Dimension Lines ─────────────────────────────────────────────────────────

export interface DesignDimension {
  id: string;
  p1: Point2D;
  p2: Point2D;
}

// ─── Text Blocks ─────────────────────────────────────────────────────────────

export interface DesignTextBlock {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

// ─── Layer Settings ──────────────────────────────────────────────────────────

export interface LayerVisibility {
  arc: boolean;
  stringing: boolean;
  hCenter: boolean;
  setbackLines: boolean;
  obstructionLabels: boolean;
}

// ─── Design Defaults ─────────────────────────────────────────────────────────

export interface DesignDefaults {
  id: string;
  name: string;
  isActive: boolean;
  moduleSpecId: string;
  templateType: TemplateType;
  structureType: StructureType;
  tilt: number;
  azimuth: number;
  mountHeight: number;
  rowSpacingMode: 'auto' | 'manual';
  rowSpacing: number;
  vSpacing: number;
  hSpacing: number;
  tableRows: number;
  tableCols: number;
  orientation: Orientation;
  cylinderDefaultHeight: number;
  handrailDefaultHeight: number;
  setbackDefault: number;
  degradationRate: number;
  systemLosses: number;
  monofacialMode: boolean;
}

// ─── Solar Access ────────────────────────────────────────────────────────────

export interface SolarAccessResult {
  [moduleId: string]: number;
}

// ─── Full Design State ──────────────────────────────────────────────────────

export interface DesignData {
  roofs: DesignRoof[];
  obstructions: DesignObstruction[];
  subArrays: DesignSubArray[];
  inverters: DesignInverter[];
  dimensions: DesignDimension[];
  textBlocks: DesignTextBlock[];
  solarAccess: SolarAccessResult;
}

// ─── Clipboard ───────────────────────────────────────────────────────────────

export interface ClipboardItem {
  type: 'module' | 'obstruction' | 'textBlock' | 'subArray';
  data: any;
  originalPosition: Point2D;
}
