// =============================================================================
// Mounting Structure Engine — pure TypeScript structural geometry + BOM
// =============================================================================

import type {
  BOMItem,
  DesignSubArray,
  FoundationDescriptor,
  ModuleSpec,
  MountingConfig,
  MountingStructureType,
  StructuralAssembly,
  StructuralMaterial,
  StructuralMember,
  StructuralMemberType,
} from '../store/types';
import { DEFAULT_MOUNTING_CONFIGS } from '../store/types';

const DEG = Math.PI / 180;

export interface StructureGenerationInput {
  subArray: DesignSubArray;
  moduleSpec: ModuleSpec;
  pxPerMeter: number;
  baseElevationM?: number;
}

type Vec3 = [number, number, number];

interface AssemblyDraft {
  members: StructuralMember[];
  foundations: FoundationDescriptor[];
}

const MATERIAL_DENSITY_KG_M3: Record<StructuralMaterial, number> = {
  steel_galv: 7850,
  aluminum: 2700,
  stainless: 8000,
  concrete: 2400,
};

const MEMBER_LABELS: Record<StructuralMemberType, string> = {
  column: 'Vertical support posts',
  rail: 'Module support rails',
  rafter: 'Tilt rafters',
  purlin: 'Longitudinal purlins',
  brace: 'Diagonal bracing',
  torque_tube: 'Tracker torque tube',
  clamp: 'Module clamps',
  foundation: 'Foundation hardware',
  ballast: 'Concrete ballast blocks',
  l_foot: 'Roof L-feet',
  bearing: 'Tracker bearings',
  drive_unit: 'Tracker drive unit',
  crossbeam: 'Crossbeams',
};

export function resolveMountingConfig(subArray: DesignSubArray): MountingConfig {
  const structureType = subArray.mountingConfig?.structureType
    ?? structureTypeFromTemplate(subArray.templateType);
  const defaults = DEFAULT_MOUNTING_CONFIGS[structureType];

  return {
    structureType,
    tilt: subArray.tilt,
    azimuth: subArray.azimuth,
    groundClearanceM: subArray.mountHeight || defaults.groundClearanceM || 0.2,
    legSpacingM: defaults.legSpacingM || 2,
    tableWidthM: 0,
    tableHeightM: 0,
    foundationType: defaults.foundationType || 'pile',
    foundationDepthM: defaults.foundationDepthM || 0,
    columnSectionMm: defaults.columnSectionMm || 80,
    railSectionW: defaults.railSectionW || 50,
    railSectionH: defaults.railSectionH || 35,
    bracingEnabled: defaults.bracingEnabled ?? false,
    material: defaults.material || 'steel_galv',
    windZone: defaults.windZone || 'II',
    snowLoadKPa: defaults.snowLoadKPa || 0.75,
    ewTiltDeg: defaults.ewTiltDeg ?? 10,
    trackerRotationDeg: defaults.trackerRotationDeg ?? 0,
    driveAisleWidthM: defaults.driveAisleWidthM ?? 1,
    ...subArray.mountingConfig,
  };
}

export function generateStructure(input: StructureGenerationInput): StructuralAssembly {
  const config = resolveMountingConfig(input.subArray);

  const draft = (() => {
    switch (config.structureType) {
      case 'flush_roof':
        return generateFlushRooftop(input, config);
      case 'elevated_roof':
        return generateElevatedRooftop(input, config);
      case 'fixed_tilt_single':
        return generateFixedTiltSingle(input, config);
      case 'fixed_tilt_double':
        return generateFixedTiltDouble(input, config);
      case 'east_west':
        return generateEastWest(input, config);
      case 'ballasted_roof':
        return generateBallasted(input, config);
      case 'sat_single_axis':
        return generateSingleAxisTracker(input, config);
      default:
        return generateFlushRooftop(input, config);
    }
  })();

  return {
    ...draft,
    bom: generateBOM(draft, input.subArray, config),
  };
}

export function generateFlushRooftop(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    addRailPair(members, table, ctx, 0.15, 0.85, 'aluminum');
    addFoundationLine(members, foundations, table, ctx, 'l_foot', 0.18);
    addClamps(members, table, ctx);
  }

  return { members, foundations };
}

export function generateElevatedRooftop(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    const frontZ = supportEdgeZ(table, -1);
    const backZ = supportEdgeZ(table, 1);
    for (const x of supportXs(table, ctx.config.legSpacingM)) {
      const frontBase = localToWorld(table, [x, ctx.baseY, frontZ]);
      const backBase = localToWorld(table, [x, ctx.baseY, backZ]);
      const frontTop = localToWorld(table, [x, table.planeYAt(frontZ) - 0.05, frontZ]);
      const backTop = localToWorld(table, [x, table.planeYAt(backZ) - 0.05, backZ]);
      members.push(member('column', frontBase, frontTop, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member('column', backBase, backTop, ctx.columnW, ctx.columnW, ctx.config.material));
      addFoundation(foundations, frontBase, ctx, ctx.foundationW);
      addFoundation(foundations, backBase, ctx, ctx.foundationW);
    }
    addRailPair(members, table, ctx, 0.18, 0.82);
  }

  return { members, foundations };
}

export function generateFixedTiltSingle(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    for (const x of supportXs(table, ctx.config.legSpacingM)) {
      const postBase = localToWorld(table, [x, ctx.baseY, 0]);
      const postTop = localToWorld(table, [x, table.planeYAt(0) - 0.1, 0]);
      const beamA = localToWorld(table, [x, table.planeYAt(-table.height / 2), -table.height / 2]);
      const beamB = localToWorld(table, [x, table.planeYAt(table.height / 2), table.height / 2]);
      members.push(member('column', postBase, postTop, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member('rafter', beamA, beamB, ctx.railW, ctx.railH, ctx.config.material));
      if (ctx.config.bracingEnabled) {
        members.push(member('brace', postBase, beamB, ctx.railW * 0.65, ctx.railH * 0.65, ctx.config.material));
      }
      addFoundation(foundations, postBase, ctx, ctx.foundationW);
    }
    addPurlins(members, table, ctx, 3);
    addRailPair(members, table, ctx, 0.18, 0.82);
  }

  return { members, foundations };
}

export function generateFixedTiltDouble(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    const frontZ = supportEdgeZ(table, -1);
    const backZ = supportEdgeZ(table, 1);
    for (const x of supportXs(table, ctx.config.legSpacingM)) {
      const frontBase = localToWorld(table, [x, ctx.baseY, frontZ]);
      const backBase = localToWorld(table, [x, ctx.baseY, backZ]);
      const frontTop = localToWorld(table, [x, table.planeYAt(frontZ) - 0.08, frontZ]);
      const backTop = localToWorld(table, [x, table.planeYAt(backZ) - 0.08, backZ]);
      members.push(member('column', frontBase, frontTop, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member('column', backBase, backTop, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member('rafter', frontTop, backTop, ctx.railW, ctx.railH, ctx.config.material));
      if (ctx.config.bracingEnabled) members.push(member('brace', frontBase, backTop, ctx.railW * 0.65, ctx.railH * 0.65, ctx.config.material));
      addFoundation(foundations, frontBase, ctx, ctx.foundationW);
      addFoundation(foundations, backBase, ctx, ctx.foundationW);
    }
    addPurlins(members, table, ctx, 3);
    addRailPair(members, table, ctx, 0.18, 0.82);
  }

  return { members, foundations };
}

export function generateEastWest(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, { ...config, tilt: config.ewTiltDeg ?? 10 });
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    const ridgeY = ctx.baseY + ctx.config.groundClearanceM + 0.35;
    const ewPlaneYAt = (z: number) => ridgeY - Math.abs(z) * Math.sin(ctx.tiltRad);

    for (const x of supportXs(table, ctx.config.legSpacingM)) {
      const base = localToWorld(table, [x, ctx.baseY, 0]);
      const top = localToWorld(table, [x, ridgeY, 0]);
      members.push(member('column', base, top, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member('rafter', top, localToWorld(table, [x, ewPlaneYAt(-table.height / 2), -table.height / 2]), ctx.railW, ctx.railH, ctx.config.material));
      members.push(member('rafter', top, localToWorld(table, [x, ewPlaneYAt(table.height / 2), table.height / 2]), ctx.railW, ctx.railH, ctx.config.material));
      addFoundation(foundations, base, ctx, ctx.foundationW);
    }

    for (const t of [0.18, 0.42, 0.58, 0.82]) {
      const z = -table.height / 2 + table.height * t;
      members.push(member(
        'rail',
        localToWorld(table, [-table.width / 2, ewPlaneYAt(z), z]),
        localToWorld(table, [table.width / 2, ewPlaneYAt(z), z]),
        ctx.railW,
        ctx.railH,
        ctx.config.material,
      ));
    }
  }

  return { members, foundations };
}

export function generateBallasted(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    addRailPair(members, table, ctx, 0.2, 0.8, 'aluminum');
    for (const x of supportXs(table, 1.5)) {
      for (const z of [-table.height / 2 + 0.25, table.height / 2 - 0.25]) {
        const pos = localToWorld(table, [x, ctx.baseY, z]);
        addFoundation(foundations, pos, ctx, 0.6, 'ballast');
      }
    }
  }

  return { members, foundations };
}

export function generateSingleAxisTracker(input: StructureGenerationInput, config = resolveMountingConfig(input.subArray)): AssemblyDraft {
  const ctx = makeContext(input, config);
  const members: StructuralMember[] = [];
  const foundations: FoundationDescriptor[] = [];

  for (const table of ctx.tables) {
    const axisY = ctx.baseY + ctx.config.groundClearanceM + 0.35;
    const axisA = localToWorld(table, [-table.width / 2, axisY, 0]);
    const axisB = localToWorld(table, [table.width / 2, axisY, 0]);
    members.push(member('torque_tube', axisA, axisB, ctx.railW * 1.4, ctx.railH * 1.4, 'steel_galv', { trackerAxis: true }));

    const xs = supportXs(table, ctx.config.legSpacingM);
    for (const [idx, x] of xs.entries()) {
      const base = localToWorld(table, [x, ctx.baseY, 0]);
      const top = localToWorld(table, [x, axisY, 0]);
      members.push(member('column', base, top, ctx.columnW, ctx.columnW, ctx.config.material));
      members.push(member(idx === 0 ? 'drive_unit' : 'bearing', [top[0] - 0.18, top[1], top[2]], [top[0] + 0.18, top[1], top[2]], 0.22, 0.22, 'steel_galv'));
      addFoundation(foundations, base, ctx, ctx.foundationW);
    }
    addPurlins(members, { ...table, tiltRad: 0, planeYAt: () => axisY + ctx.railH * 0.75 }, ctx, 3);
  }

  return { members, foundations };
}

export function generateBOM(draft: AssemblyDraft, subArray: DesignSubArray, config: MountingConfig): BOMItem[] {
  const memberGroups = new Map<string, { type: StructuralMemberType; material: StructuralMaterial; length: number; volume: number; count: number }>();

  for (const m of draft.members) {
    const length = distance(m.start, m.end);
    const volume = Math.max(length, 0.05) * m.sectionW * m.sectionH;
    const key = `${m.type}:${m.material}`;
    const prev = memberGroups.get(key) || { type: m.type, material: m.material, length: 0, volume: 0, count: 0 };
    prev.length += length;
    prev.volume += volume;
    prev.count += 1;
    memberGroups.set(key, prev);
  }

  const items: BOMItem[] = Array.from(memberGroups.values()).map(group => {
    const isEach = ['clamp', 'l_foot', 'bearing', 'drive_unit', 'ballast'].includes(group.type);
    const category = group.type === 'ballast' ? 'foundation'
      : group.type === 'rail' ? 'rails'
        : ['clamp', 'bearing', 'drive_unit', 'l_foot'].includes(group.type) ? 'fasteners'
          : 'structural';
    const totalWeightKg = group.volume * MATERIAL_DENSITY_KG_M3[group.material];

    return {
      category,
      description: `${MEMBER_LABELS[group.type]} (${materialLabel(group.material)})`,
      unit: isEach ? 'pcs' : 'm',
      quantity: round(isEach ? group.count : group.length),
      unitWeightKg: isEach ? round(totalWeightKg / Math.max(group.count, 1)) : undefined,
      totalWeightKg: round(totalWeightKg),
      notes: `${group.count} pieces`,
    };
  });

  const foundationCount = draft.foundations.length;
  if (foundationCount > 0) {
    const concreteVolume = draft.foundations
      .filter(f => f.type === 'rcc_footing' || f.type === 'pile' || f.type === 'screw_pile' || f.type === 'ballast')
      .reduce((sum, f) => sum + f.widthM * f.widthM * Math.max(f.depthM, f.type === 'ballast' ? 0.16 : 0.25), 0);

    items.push({
      category: 'foundation',
      description: `${foundationLabel(config.foundationType)} points`,
      unit: 'pcs',
      quantity: foundationCount,
      notes: `${round(concreteVolume)} m3 estimated concrete/ballast volume`,
    });
  }

  items.push({
    category: 'fasteners',
    description: 'Mid/end clamps and hardware',
    unit: 'pcs',
    quantity: subArray.modules.length * 4,
    notes: 'Estimated four module clamps per panel',
  });

  return items.sort((a, b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description));
}

function makeContext(input: StructureGenerationInput, config: MountingConfig) {
  const moduleW = input.subArray.orientation === 'landscape'
    ? input.moduleSpec.lengthMm / 1000
    : input.moduleSpec.widthMm / 1000;
  const moduleH = input.subArray.orientation === 'landscape'
    ? input.moduleSpec.widthMm / 1000
    : input.moduleSpec.lengthMm / 1000;
  const tiltRad = config.tilt * DEG;
  const azimuthRad = (config.azimuth - 180) * DEG;
  const baseY = input.baseElevationM ?? 0;
  const railW = config.railSectionW / 1000;
  const railH = config.railSectionH / 1000;

  return {
    config,
    moduleW,
    moduleH,
    tiltRad,
    azimuthRad,
    baseY,
    railW,
    railH,
    columnW: config.columnSectionMm / 1000,
    foundationW: Math.max(0.25, config.columnSectionMm / 500),
    pxPerMeter: input.pxPerMeter,
    tables: buildTables(input, moduleW, moduleH, tiltRad, azimuthRad, config.groundClearanceM),
  };
}

function buildTables(input: StructureGenerationInput, moduleW: number, moduleH: number, tiltRad: number, azimuthRad: number, groundClearanceM: number) {
  const grouped = new Map<string, typeof input.subArray.modules>();
  for (const mod of input.subArray.modules) {
    const tableR = Math.floor(mod.row / Math.max(input.subArray.tableRows, 1));
    const tableC = Math.floor(mod.col / Math.max(input.subArray.tableCols, 1));
    const key = `${tableR}:${tableC}`;
    grouped.set(key, [...(grouped.get(key) || []), mod]);
  }

  return Array.from(grouped.values()).map(modules => {
    const xs = modules.map(m => m.x / input.pxPerMeter);
    const zs = modules.map(m => m.y / input.pxPerMeter);
    const width = Math.max(moduleW, Math.max(...xs) - Math.min(...xs) + moduleW);
    const height = Math.max(moduleH, Math.max(...zs) - Math.min(...zs) + moduleH);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const planeYAt = (z: number) => (input.baseElevationM ?? 0) + groundClearanceM + (z + height / 2) * Math.sin(tiltRad);

    return {
      cx,
      cz,
      width,
      height,
      tiltRad,
      azimuthRad,
      modules,
      planeYAt,
    };
  });
}

function addRailPair(members: StructuralMember[], table: ReturnType<typeof buildTables>[number], ctx: ReturnType<typeof makeContext>, a: number, b: number, material = ctx.config.material) {
  for (const t of [a, b]) {
    const z = -table.height / 2 + table.height * t;
    members.push(member(
      'rail',
      localToWorld(table, [-table.width / 2, table.planeYAt(z), z]),
      localToWorld(table, [table.width / 2, table.planeYAt(z), z]),
      ctx.railW,
      ctx.railH,
      material,
    ));
  }
}

function addPurlins(members: StructuralMember[], table: ReturnType<typeof buildTables>[number], ctx: ReturnType<typeof makeContext>, count: number) {
  for (let i = 0; i < count; i++) {
    const z = -table.height / 2 + (table.height * (i + 1)) / (count + 1);
    members.push(member('purlin', localToWorld(table, [-table.width / 2, table.planeYAt(z), z]), localToWorld(table, [table.width / 2, table.planeYAt(z), z]), ctx.railW, ctx.railH, ctx.config.material));
  }
}

function addClamps(members: StructuralMember[], table: ReturnType<typeof buildTables>[number], ctx: ReturnType<typeof makeContext>) {
  for (const mod of table.modules) {
    const x = mod.x / ctx.pxPerMeter - table.cx;
    const z = mod.y / ctx.pxPerMeter - table.cz;
    for (const dx of [-0.35, 0.35]) {
      members.push(member('clamp', localToWorld(table, [x + dx, table.planeYAt(z) + 0.03, z]), localToWorld(table, [x + dx + 0.08, table.planeYAt(z) + 0.03, z]), 0.04, 0.025, 'stainless'));
    }
  }
}

function addFoundationLine(members: StructuralMember[], foundations: FoundationDescriptor[], table: ReturnType<typeof buildTables>[number], ctx: ReturnType<typeof makeContext>, type: StructuralMemberType, width: number) {
  for (const x of supportXs(table, ctx.config.legSpacingM)) {
    for (const z of [-table.height / 2 + 0.2, table.height / 2 - 0.2]) {
      const pos = localToWorld(table, [x, ctx.baseY + 0.03, z]);
      members.push(member(type, [pos[0] - width / 2, pos[1], pos[2]], [pos[0] + width / 2, pos[1], pos[2]], width, 0.06, 'aluminum'));
      addFoundation(foundations, pos, ctx, 0.22);
    }
  }
}

function supportXs(table: ReturnType<typeof buildTables>[number], spacing: number): number[] {
  const count = Math.max(2, Math.ceil(table.width / Math.max(spacing, 0.5)) + 1);
  const inset = Math.min(0.35, table.width * 0.12);
  const span = Math.max(0.2, table.width - inset * 2);
  return Array.from({ length: count }, (_, i) => -span / 2 + (span * i) / (count - 1));
}

function supportEdgeZ(table: ReturnType<typeof buildTables>[number], direction: -1 | 1): number {
  const inset = Math.min(0.35, table.height * 0.16);
  return direction * (table.height / 2 - inset);
}

function addFoundation(foundations: FoundationDescriptor[], pos: Vec3, ctx: ReturnType<typeof makeContext>, widthM: number, overrideType = ctx.config.foundationType) {
  foundations.push({
    type: overrideType,
    positionX: pos[0],
    positionZ: pos[2],
    elevationM: pos[1],
    depthM: ctx.config.foundationDepthM,
    widthM,
  });
}

function localToWorld(table: { cx: number; cz: number; azimuthRad?: number }, p: Vec3): Vec3 {
  const a = table.azimuthRad || 0;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const x = p[0] * cos - p[2] * sin;
  const z = p[0] * sin + p[2] * cos;
  return [table.cx + x, p[1], table.cz + z];
}

function member(type: StructuralMemberType, start: Vec3, end: Vec3, sectionW: number, sectionH: number, material: StructuralMaterial, metadata?: Record<string, unknown>): StructuralMember {
  return { type, start, end, sectionW, sectionH, material, metadata };
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function materialLabel(material: StructuralMaterial): string {
  return material.replace('_', ' ');
}

function foundationLabel(type: string): string {
  return type.replace('_', ' ');
}

function structureTypeFromTemplate(templateType: DesignSubArray['templateType']): MountingStructureType {
  if (templateType === 'ew_tracking') return 'east_west';
  if (templateType === 'roof_mount') return 'flush_roof';
  return 'fixed_tilt_double';
}
