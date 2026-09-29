// =============================================================================
// Right Panel — Context-Sensitive Properties
// =============================================================================

import { useState, useMemo } from 'react';
import { useDesignStore, MODULE_DATABASE, INVERTER_DATABASE } from '../store/designStore';
import type {
  BOMItem,
  DesignRoof,
  DesignObstruction,
  DesignSubArray,
  DesignInverter,
  FoundationType,
  MountingConfig,
  MountingStructureType,
  StructuralMaterial,
  TreeModelType,
} from '../store/types';
import { DEFAULT_MOUNTING_CONFIGS } from '../store/types';
import { uid, polygonArea, shadowFreeRowSpacing } from '../utils/geometry';
import { runPlacement, autoRowSpacingPx } from '../engine/PlacementEngine';
import { calculateEnergyYield } from '../engine/EnergyYield';
import { calculateWireSize } from '../engine/WireSizeCalc';
import { generateStructure, resolveMountingConfig } from '../engine/MountingStructureEngine';
import SunPathPanel from './SunPathPanel';
import EnergyCalculationPanel from './EnergyCalculationPanel';

const TREE_MODELS: { type: TreeModelType; icon: string; label: string }[] = [
  { type: 'spruce', icon: '🌲', label: 'Spruce' },
  { type: 'pine', icon: '🌲', label: 'Pine' },
  { type: 'apple', icon: '🍎', label: 'Apple' },
  { type: 'oak', icon: '🌳', label: 'Oak' },
  { type: 'palm', icon: '🌴', label: 'Palm' },
  { type: 'conifer', icon: '🎄', label: 'Conifer' },
];

export default function RightPanel() {
  const store = useDesignStore();

  // Determine what to show
  const selectedId = store.selectedIds[0];
  const selectedType = store.selectedType;

  if (!selectedId || !selectedType) return <DesignSummary />;

  switch (selectedType) {
    case 'roof': {
      const roof = store.roofs.find(r => r.id === selectedId);
      if (roof) return <RoofPanel roof={roof} />;
      break;
    }
    case 'obstruction': {
      const obs = store.obstructions.find(o => o.id === selectedId);
      if (obs) {
        if (obs.type === 'tree') return <TreePanel obs={obs} />;
        return <ObstructionPanel obs={obs} />;
      }
      break;
    }
    case 'module': {
      // Find which sub-array
      for (const sa of store.subArrays) {
        if (sa.modules.some(m => m.id === selectedId)) {
          return <SubArrayPanel subArray={sa} />;
        }
      }
      break;
    }
    case 'inverter': {
      const inv = store.inverters.find(i => i.id === selectedId);
      if (inv) return <InverterPanel inverter={inv} />;
      break;
    }
    case 'dimension': {
      const dim = store.dimensions.find(d => d.id === selectedId);
      if (dim) return <DimensionPanel dimId={dim.id} p1={dim.p1} p2={dim.p2} />;
      break;
    }
    case 'textBlock': {
      const tb = store.textBlocks.find(t => t.id === selectedId);
      if (tb) return <TextBlockPanel tb={tb} />;
      break;
    }
  }

  return <DesignSummary />;
}

// ─── Design Summary (default) ────────────────────────────────────────────────

function DesignSummary() {
  const store = useDesignStore();
  const totalModules = store.subArrays.reduce((s, sa) => s + sa.modules.length, 0);
  const totalKwp = useMemo(() => {
    let kw = 0;
    for (const sa of store.subArrays) {
      const spec = MODULE_DATABASE.find(m => m.id === sa.moduleSpecId);
      if (spec) kw += sa.modules.length * spec.wattage / 1000;
    }
    return kw;
  }, [store.subArrays]);

  const yield_ = useMemo(() => {
    if (totalModules === 0) return null;
    const spec = MODULE_DATABASE.find(m => m.id === store.subArrays[0]?.moduleSpecId);
    if (!spec) return null;
    return calculateEnergyYield({ panelCount: totalModules, moduleWattage: spec.wattage });
  }, [totalModules, store.subArrays]);

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Design Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{totalModules}</div>
            <div className="stat-label">Modules</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>{totalKwp.toFixed(1)}</div>
            <div className="stat-label">kWp</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{store.roofs.length}</div>
            <div className="stat-label">Roofs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{store.inverters.length}</div>
            <div className="stat-label">Inverters</div>
          </div>
        </div>
      </div>

      {yield_ && (
        <div className="panel-section">
          <div className="panel-section-title">Energy Yield</div>
          <div className="panel-field-row">
            <span className="panel-label">Annual Generation</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{yield_.annualKwh.toLocaleString()} kWh</span>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">Specific Yield</span>
            <span style={{ fontWeight: 600 }}>{yield_.specificYield} kWh/kWp</span>
          </div>
          <div className="panel-field-row">
            <span className="panel-label">25yr Generation</span>
            <span style={{ fontWeight: 600 }}>{(yield_.lifetimeGeneration / 1000).toFixed(0)} MWh</span>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">Layers</div>
        {(Object.keys(store.layers) as Array<keyof typeof store.layers>).map(key => (
          <div key={key} className="layer-checkbox">
            <input
              type="checkbox"
              id={`layer-${key}`}
              checked={store.layers[key]}
              onChange={(e) => store.setLayerVisibility(key, e.target.checked)}
            />
            <label htmlFor={`layer-${key}`}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
          </div>
        ))}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Settings</div>
        <div className="panel-field">
          <span className="panel-label">Scale (px/meter)</span>
          <input type="number" className="panel-input" value={store.pxPerMeter}
            onChange={e => store.setPxPerMeter(Number(e.target.value) || 20)} />
        </div>
        <div className="panel-field">
          <span className="panel-label">Site Latitude</span>
          <input type="number" className="panel-input" value={store.latitude} step="0.1"
            onChange={e => store.setPxPerMeter(Number(e.target.value) || 28.6)} />
        </div>
      </div>

      {/* Sun Path Simulation */}
      <SunPathPanel />

      {/* Energy Calculation */}
      <div className="panel-section" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px 0', borderBottom: 'none' }}>
          <div className="panel-section-title">Energy Calculation</div>
        </div>
        <EnergyCalculationPanel />
      </div>
    </div>
  );
}

// ─── Roof Panel ──────────────────────────────────────────────────────────────

function RoofPanel({ roof }: { roof: DesignRoof }) {
  const store = useDesignStore();
  const [showFillModal, setShowFillModal] = useState(false);

  const areaSqM = polygonArea(roof.vertices) / (store.pxPerMeter * store.pxPerMeter);

  const handleUpdate = (updates: Partial<DesignRoof>) => {
    store.updateRoof(roof.id, updates);
  };

  const handleFillFace = () => {
    const spec = MODULE_DATABASE[1]; // Default: Waaree 540W
    const mw = spec.widthMm / 1000 * store.pxPerMeter;
    const mh = spec.lengthMm / 1000 * store.pxPerMeter;
    const setbackPx = ((roof.setbacks.n + roof.setbacks.e + roof.setbacks.s + roof.setbacks.w) / 4) * store.pxPerMeter;

    const obsPolygons = store.obstructions
      .filter(o => o.roofId === roof.id && o.vertices.length >= 3)
      .map(o => o.vertices);

    const rowSpPx = autoRowSpacingPx(spec.lengthMm / 1000, roof.tilt, store.latitude, store.pxPerMeter);

    const result = runPlacement({
      roofPolygon: roof.vertices,
      obstructions: obsPolygons,
      moduleWidthPx: mw, moduleHeightPx: mh,
      orientation: 'portrait', tiltDeg: roof.tilt, azimuthDeg: roof.azimuth,
      rowSpacingPx: rowSpPx, colSpacingPx: 0.02 * store.pxPerMeter,
      tableRows: 2, tableCols: 3, tableSpacingPx: 0.5 * store.pxPerMeter,
      setbackPx, obstructionBufferPx: 0.1 * store.pxPerMeter,
    });

    if (result.modules.length > 0) {
      // Clear existing sub-arrays on this roof
      store.subArrays
        .filter(sa => sa.roofId === roof.id)
        .forEach(sa => store.deleteSubArray(sa.id));

      const saId = uid();
      const mods = result.modules.map(m => ({ ...m, subArrayId: saId }));
      store.addSubArray({
        id: saId, roofId: roof.id, moduleSpecId: spec.id,
        modules: mods, tilt: roof.tilt, azimuth: roof.azimuth,
        mountHeight: 0.15, rowSpacing: rowSpPx / store.pxPerMeter,
        rowSpacingMode: 'auto', orientation: 'portrait',
        tableRows: 2, tableCols: 3, vSpacing: 0.02, hSpacing: 0.02,
        tableSpacing: 0.5, templateType: roof.templateType, structureType: roof.structureType,
      });
    }
  };

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Roof Properties</div>
        <div className="panel-field">
          <span className="panel-label">Name</span>
          <input className="panel-input" value={roof.name}
            onChange={e => handleUpdate({ name: e.target.value })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Area</span>
          <span style={{ fontWeight: 600 }}>{areaSqM.toFixed(1)} m²</span>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Configuration</div>
        <div className="panel-field">
          <span className="panel-label">Template</span>
          <select className="panel-select" value={roof.templateType}
            onChange={e => handleUpdate({ templateType: e.target.value as any })}>
            <option value="tilted_mount">Tilted Mount</option>
            <option value="roof_mount">Roof Mount</option>
            <option value="ew_tracking">E-W Tracking</option>
          </select>
        </div>

        {(roof.templateType === 'roof_mount') && (
          <div className="panel-field">
            <span className="panel-label">Structure Type</span>
            <select className="panel-select" value={roof.structureType}
              onChange={e => handleUpdate({ structureType: e.target.value as any })}>
              <option value="default">Default</option>
              <option value="pergola">Pergola</option>
              <option value="tata_power">Tata Power</option>
              <option value="relay_rack">Relay Rack</option>
              <option value="textile_2500">Textile 2500</option>
            </select>
          </div>
        )}

        <div className="panel-field-row">
          <span className="panel-label">Tilt (°)</span>
          <input type="number" className="panel-input-sm" min={0} max={90} value={roof.tilt}
            onChange={e => handleUpdate({ tilt: Number(e.target.value) })} />
        </div>

        <div className="panel-field">
          <span className="panel-label">Azimuth</span>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[{ label: 'N', deg: 0 }, { label: 'E', deg: 90 }, { label: 'S', deg: 180 }, { label: 'W', deg: 270 }].map(a => (
              <button key={a.label}
                className={`quick-az-btn ${roof.azimuth === a.deg ? 'active' : ''}`}
                onClick={() => handleUpdate({ azimuth: a.deg })}>{a.label}</button>
            ))}
          </div>
          <input type="number" className="panel-input-sm" min={0} max={360} value={roof.azimuth}
            onChange={e => handleUpdate({ azimuth: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Setbacks (m)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['n', 'e', 's', 'w'] as const).map(dir => (
            <div key={dir} className="panel-field-row" style={{ marginBottom: 0 }}>
              <span className="panel-label">{dir.toUpperCase()}</span>
              <input type="number" className="panel-input-sm" step={0.1} min={0}
                value={roof.setbacks[dir]}
                onChange={e => handleUpdate({ setbacks: { ...roof.setbacks, [dir]: Number(e.target.value) } })} />
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Height</div>
        <div className="panel-field-row">
          <span className="panel-label">Base Height (m)</span>
          <input type="number" className="panel-input-sm" step={0.5} value={roof.baseHeight}
            onChange={e => handleUpdate({ baseHeight: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Parapet (m)</span>
          <input type="number" className="panel-input-sm" step={0.1} value={roof.parapetHeight}
            onChange={e => handleUpdate({ parapetHeight: Number(e.target.value) })} />
        </div>
        <div className="layer-checkbox">
          <input type="checkbox" checked={roof.flashType}
            onChange={e => handleUpdate({ flashType: e.target.checked })} />
          <label>Flash type</label>
        </div>
      </div>

      <div className="panel-section">
        <button className="panel-btn panel-btn-primary" onClick={handleFillFace}>
          ◫ Fill Face
        </button>
        <button className="panel-btn" onClick={() => setShowFillModal(true)} style={{ marginTop: 8 }}>
          ⚙ Fill Face Settings
        </button>
        <button className="panel-btn" onClick={() => store.setActiveTool('add_table')} style={{ marginTop: 8 }}>
          + Add Table
        </button>
      </div>

      <div className="panel-section">
        <button className="panel-btn panel-btn-danger" onClick={() => store.deleteRoof(roof.id)}>
          🗑 Delete Roof
        </button>
      </div>
    </div>
  );
}

// ─── Obstruction Panel ───────────────────────────────────────────────────────

function ObstructionPanel({ obs }: { obs: DesignObstruction }) {
  const store = useDesignStore();

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Obstruction — {obs.type}</div>
        <div className="panel-field-row">
          <span className="panel-label">Height (m)</span>
          <input type="number" className="panel-input-sm" step={0.1} value={obs.height}
            onChange={e => store.updateObstruction(obs.id, { height: Number(e.target.value) })} />
        </div>
        {obs.radius !== undefined && (
          <div className="panel-field-row">
            <span className="panel-label">Radius (px)</span>
            <input type="number" className="panel-input-sm" value={obs.radius}
              onChange={e => store.updateObstruction(obs.id, { radius: Number(e.target.value) })} />
          </div>
        )}
        {obs.width !== undefined && (
          <div className="panel-field-row">
            <span className="panel-label">Width (m)</span>
            <input type="number" className="panel-input-sm" step={0.1} value={obs.width}
              onChange={e => store.updateObstruction(obs.id, { width: Number(e.target.value) })} />
          </div>
        )}
      </div>
      <div className="panel-section">
        <button className="panel-btn panel-btn-primary"
          onClick={() => store.updateObstruction(obs.id, {})} >Update</button>
        <button className="panel-btn panel-btn-danger" style={{ marginTop: 8 }}
          onClick={() => store.deleteObstruction(obs.id)}>🗑 Delete</button>
      </div>
    </div>
  );
}

// ─── Tree Panel ──────────────────────────────────────────────────────────────

function TreePanel({ obs }: { obs: DesignObstruction }) {
  const store = useDesignStore();

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Tree</div>
        <div className="panel-field-row">
          <span className="panel-label">Trunk Height (m)</span>
          <input type="number" className="panel-input-sm" step={0.5} value={obs.trunkHeight || 3}
            onChange={e => store.updateObstruction(obs.id, { trunkHeight: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Crown Height (m)</span>
          <input type="number" className="panel-input-sm" step={0.5} value={obs.crownHeight || 4}
            onChange={e => store.updateObstruction(obs.id, { crownHeight: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Crown Radius (m)</span>
          <input type="number" className="panel-input-sm" step={0.5} value={obs.crownRadius || 2.5}
            onChange={e => store.updateObstruction(obs.id, { crownRadius: Number(e.target.value) })} />
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Tree Model</div>
        <div className="tree-model-grid">
          {TREE_MODELS.map(tm => (
            <div key={tm.type}
              className={`tree-model-card ${obs.treeModel === tm.type ? 'selected' : ''}`}
              onClick={() => store.updateObstruction(obs.id, { treeModel: tm.type })}>
              <div className="tree-model-icon">{tm.icon}</div>
              <div>{tm.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <button className="panel-btn panel-btn-primary"
          onClick={() => store.updateObstruction(obs.id, {})}>Update</button>
        <button className="panel-btn panel-btn-danger" style={{ marginTop: 8 }}
          onClick={() => store.deleteObstruction(obs.id)}>🗑 Delete</button>
      </div>
    </div>
  );
}

// ─── Sub-Array Panel ─────────────────────────────────────────────────────────

function SubArrayPanel({ subArray }: { subArray: DesignSubArray }) {
  const store = useDesignStore();
  const spec = MODULE_DATABASE.find(m => m.id === subArray.moduleSpecId);

  const handleUpdate = (updates: Partial<DesignSubArray>) => {
    store.updateSubArray(subArray.id, updates);
  };

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Sub-Array — {subArray.modules.length} modules</div>

        <div className="panel-field">
          <span className="panel-label">Module</span>
          <select className="panel-select" value={subArray.moduleSpecId}
            onChange={e => handleUpdate({ moduleSpecId: e.target.value })}>
            {MODULE_DATABASE.map(m => (
              <option key={m.id} value={m.id}>{m.brand} {m.model} ({m.wattage}W)</option>
            ))}
          </select>
        </div>

        {spec && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, color: '#64748b', marginBottom: 12 }}>
            <div>{spec.wattage}W</div>
            <div>{spec.lengthMm}×{spec.widthMm}</div>
            <div>{(spec.efficiency * 100).toFixed(1)}%</div>
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Configuration</div>
        <div className="panel-field">
          <span className="panel-label">Template</span>
          <select className="panel-select" value={subArray.templateType}
            onChange={e => handleUpdate({ templateType: e.target.value as any })}>
            <option value="tilted_mount">Tilted Mount</option>
            <option value="roof_mount">Roof Mount</option>
            <option value="ew_tracking">E-W Tracking</option>
          </select>
        </div>

        <div className="panel-field-row">
          <span className="panel-label">Tilt (°)</span>
          <input type="number" className="panel-input-sm" min={0} max={90} value={subArray.tilt}
            onChange={e => handleUpdate({ tilt: Number(e.target.value) })} />
        </div>

        <div className="panel-field">
          <span className="panel-label">Azimuth</span>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {[{ label: 'N', deg: 0 }, { label: 'E', deg: 90 }, { label: 'S', deg: 180 }, { label: 'W', deg: 270 }].map(a => (
              <button key={a.label} className={`quick-az-btn ${subArray.azimuth === a.deg ? 'active' : ''}`}
                onClick={() => handleUpdate({ azimuth: a.deg })}>{a.label}</button>
            ))}
          </div>
          <input type="number" className="panel-input-sm" value={subArray.azimuth} min={0} max={360}
            onChange={e => handleUpdate({ azimuth: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Table</div>
        <div className="panel-field-row">
          <span className="panel-label">Rows × Cols</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" className="panel-input-sm" style={{ width: 45 }} min={1} max={10}
              value={subArray.tableRows} onChange={e => handleUpdate({ tableRows: Number(e.target.value) })} />
            <span style={{ color: '#64748b' }}>×</span>
            <input type="number" className="panel-input-sm" style={{ width: 45 }} min={1} max={20}
              value={subArray.tableCols} onChange={e => handleUpdate({ tableCols: Number(e.target.value) })} />
          </div>
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Table Spacing (m)</span>
          <input type="number" className="panel-input-sm" step={0.1} value={subArray.tableSpacing}
            onChange={e => handleUpdate({ tableSpacing: Number(e.target.value) })} />
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Spacing</div>
        <div className="panel-field-row">
          <span className="panel-label">Orientation</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['portrait', 'landscape'] as const).map(o => (
              <button key={o} className={`quick-az-btn ${subArray.orientation === o ? 'active' : ''}`}
                onClick={() => handleUpdate({ orientation: o })}>{o === 'portrait' ? '▯' : '▭'}</button>
            ))}
          </div>
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Mount Height (m)</span>
          <input type="number" className="panel-input-sm" step={0.05} value={subArray.mountHeight}
            onChange={e => handleUpdate({ mountHeight: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">V-Spacing (m)</span>
          <input type="number" className="panel-input-sm" step={0.01} value={subArray.vSpacing}
            onChange={e => handleUpdate({ vSpacing: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">H-Spacing (m)</span>
          <input type="number" className="panel-input-sm" step={0.01} value={subArray.hSpacing}
            onChange={e => handleUpdate({ hSpacing: Number(e.target.value) })} />
        </div>

        <div className="panel-field">
          <div className="panel-field-row" style={{ marginBottom: 4 }}>
            <span className="panel-label">Row Spacing</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['auto', 'manual'] as const).map(mode => (
                <button key={mode} className={`quick-az-btn ${subArray.rowSpacingMode === mode ? 'active' : ''}`}
                  onClick={() => handleUpdate({ rowSpacingMode: mode })}>{mode}</button>
              ))}
            </div>
          </div>
          {subArray.rowSpacingMode === 'auto' ? (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Auto: {shadowFreeRowSpacing(spec ? spec.lengthMm / 1000 : 2.27, subArray.tilt, store.latitude).toFixed(2)}m
            </div>
          ) : (
            <input type="number" className="panel-input" step={0.1} value={subArray.rowSpacing}
              onChange={e => handleUpdate({ rowSpacing: Number(e.target.value) })} />
          )}
        </div>
      </div>

      <MountingStructurePanel subArray={subArray} />

      <div className="panel-section">
        <button className="panel-btn panel-btn-primary" onClick={() => handleUpdate({})}>Update</button>
        {store.solarAccessRun && (
          <button className="panel-btn panel-btn-success" style={{ marginTop: 8 }}>
            ⚡ Optimize
          </button>
        )}
        <button className="panel-btn panel-btn-danger" style={{ marginTop: 8 }}
          onClick={() => store.deleteSubArray(subArray.id)}>🗑 Delete Sub-Array</button>
      </div>
    </div>
  );
}

function MountingStructurePanel({ subArray }: { subArray: DesignSubArray }) {
  const store = useDesignStore();
  const spec = MODULE_DATABASE.find(m => m.id === subArray.moduleSpecId);
  const config = resolveMountingConfig(subArray);
  const fallbackBOM = useMemo(() => {
    const roof = store.roofs.find(r => r.id === subArray.roofId);
    if (!spec) return [];
    const baseElevationM = roof ? (roof.baseHeight || 0) + (roof.height || 3) + 0.2 : 0;
    return generateStructure({ subArray, moduleSpec: spec, pxPerMeter: store.pxPerMeter, baseElevationM }).bom;
  }, [spec, store.roofs, store.pxPerMeter, subArray]);
  const bom = store.bomResults[subArray.id] || fallbackBOM;

  const updateConfig = (updates: Partial<MountingConfig>) => {
    store.setSubArrayMounting(subArray.id, updates);
  };

  const updateStructureType = (structureType: MountingStructureType) => {
    const defaults = DEFAULT_MOUNTING_CONFIGS[structureType];
    updateConfig({
      ...config,
      ...defaults,
      structureType,
      tilt: subArray.tilt,
      azimuth: subArray.azimuth,
    });
  };

  const groupedBOM = groupBOM(bom);

  return (
    <>
      <div className="panel-section">
        <div className="panel-section-title">Mounting Structure</div>
        <div className="panel-field">
          <span className="panel-label">Type</span>
          <select className="panel-select" value={config.structureType}
            onChange={e => updateStructureType(e.target.value as MountingStructureType)}>
            {MOUNTING_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
            ))}
          </select>
        </div>

        <div className="panel-section-title" style={{ marginTop: 12 }}>Geometry</div>
        <NumberField label="Tilt (deg)" value={config.tilt} min={0} max={90} step={1}
          onChange={tilt => updateConfig({ tilt })} />
        <NumberField label="Azimuth" value={config.azimuth} min={0} max={360} step={1}
          onChange={azimuth => updateConfig({ azimuth })} />
        <NumberField label="Ground clear. (m)" value={config.groundClearanceM} min={0} step={0.05}
          onChange={groundClearanceM => updateConfig({ groundClearanceM })} />
        <NumberField label="Leg spacing (m)" value={config.legSpacingM} min={0.5} step={0.1}
          onChange={legSpacingM => updateConfig({ legSpacingM })} />
        {config.structureType === 'east_west' && (
          <NumberField label="E-W tilt (deg)" value={config.ewTiltDeg ?? 10} min={0} max={30} step={1}
            onChange={ewTiltDeg => updateConfig({ ewTiltDeg })} />
        )}
        {config.structureType === 'sat_single_axis' && (
          <NumberField label="Drive aisle (m)" value={config.driveAisleWidthM ?? 1} min={0} step={0.1}
            onChange={driveAisleWidthM => updateConfig({ driveAisleWidthM })} />
        )}

        <div className="panel-section-title" style={{ marginTop: 12 }}>Foundation</div>
        <div className="panel-field-row">
          <span className="panel-label">Type</span>
          <select className="panel-select" style={{ width: 135 }} value={config.foundationType}
            onChange={e => updateConfig({ foundationType: e.target.value as FoundationType })}>
            {FOUNDATION_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}
          </select>
        </div>
        <NumberField label="Depth (m)" value={config.foundationDepthM} min={0} step={0.1}
          onChange={foundationDepthM => updateConfig({ foundationDepthM })} />

        <div className="panel-section-title" style={{ marginTop: 12 }}>Material</div>
        <div className="panel-field-row">
          <span className="panel-label">Primary</span>
          <select className="panel-select" style={{ width: 135 }} value={config.material}
            onChange={e => updateConfig({ material: e.target.value as StructuralMaterial })}>
            {MATERIAL_TYPES.map(type => <option key={type} value={type}>{labelize(type)}</option>)}
          </select>
        </div>
        <NumberField label="Column (mm)" value={config.columnSectionMm} min={25} step={5}
          onChange={columnSectionMm => updateConfig({ columnSectionMm })} />
        <div className="panel-field-row">
          <span className="panel-label">Rail W x H</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" className="panel-input-sm" style={{ width: 52 }} value={config.railSectionW}
              onChange={e => updateConfig({ railSectionW: Number(e.target.value) })} />
            <input type="number" className="panel-input-sm" style={{ width: 52 }} value={config.railSectionH}
              onChange={e => updateConfig({ railSectionH: Number(e.target.value) })} />
          </div>
        </div>
        <div className="layer-checkbox">
          <input id={`bracing-${subArray.id}`} type="checkbox" checked={config.bracingEnabled}
            onChange={e => updateConfig({ bracingEnabled: e.target.checked })} />
          <label htmlFor={`bracing-${subArray.id}`}>Bracing enabled</label>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Live BOM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(groupedBOM).map(([category, items]) => (
            <div key={category}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {category}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 54px 38px', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
                {items.map((item, index) => (
                  <div key={`${item.description}-${index}`} style={{ display: 'contents' }}>
                    <span title={item.notes}>{item.description}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantity.toFixed(item.unit === 'pcs' ? 0 : 1)}</span>
                    <span style={{ color: '#64748b' }}>{item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="panel-btn" style={{ marginTop: 12 }} onClick={() => exportBOMCsv(subArray.id, bom)}>
          Export CSV
        </button>
      </div>
    </>
  );
}

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="panel-field-row">
      <span className="panel-label">{label}</span>
      <input type="number" className="panel-input-sm" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

const MOUNTING_TYPES: { value: MountingStructureType; icon: string; label: string }[] = [
  { value: 'flush_roof', icon: 'FR', label: 'Flush rooftop' },
  { value: 'elevated_roof', icon: 'ER', label: 'Elevated rooftop' },
  { value: 'fixed_tilt_single', icon: 'S1', label: 'Fixed tilt single' },
  { value: 'fixed_tilt_double', icon: 'S2', label: 'Fixed tilt double' },
  { value: 'east_west', icon: 'EW', label: 'East-west' },
  { value: 'ballasted_roof', icon: 'BL', label: 'Ballasted' },
  { value: 'sat_single_axis', icon: 'SAT', label: 'Single-axis tracker' },
];

const FOUNDATION_TYPES: FoundationType[] = ['rcc_footing', 'pile', 'screw_pile', 'ballast', 'rock_anchor', 'l_foot', 'roof_hook'];
const MATERIAL_TYPES: StructuralMaterial[] = ['steel_galv', 'aluminum', 'stainless', 'concrete'];

function groupBOM(bom: BOMItem[]): Record<string, BOMItem[]> {
  return bom.reduce<Record<string, BOMItem[]>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] || []), item];
    return groups;
  }, {});
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function exportBOMCsv(subArrayId: string, bom: BOMItem[]) {
  const header = ['Category', 'Description', 'Unit', 'Quantity', 'Unit Weight Kg', 'Total Weight Kg', 'Notes'];
  const rows = bom.map(item => [
    item.category,
    item.description,
    item.unit,
    String(item.quantity),
    item.unitWeightKg?.toString() || '',
    item.totalWeightKg?.toString() || '',
    item.notes || '',
  ]);
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bom-${subArrayId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// ─── Inverter Panel ──────────────────────────────────────────────────────────

function InverterPanel({ inverter }: { inverter: DesignInverter }) {
  const store = useDesignStore();
  const invSpec = INVERTER_DATABASE.find(s => s.id === inverter.inverterSpecId);
  const [showWireCalc, setShowWireCalc] = useState(false);
  const [wireLen, setWireLen] = useState(10);
  const [cableType, setCableType] = useState<'copper' | 'aluminium'>('copper');

  const handleAddString = (mpptIdx: number) => {
    const newStr = {
      id: uid(),
      inverterPlacementId: inverter.id,
      mpptIndex: mpptIdx,
      moduleIds: [],
    };
    store.addStringToInverter(inverter.id, newStr);
  };

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Inverter</div>
        <div className="panel-field">
          <span className="panel-label">Model</span>
          <select className="panel-select" value={inverter.inverterSpecId}
            onChange={e => store.updateInverter(inverter.id, { inverterSpecId: e.target.value })}>
            {INVERTER_DATABASE.map(i => (
              <option key={i.id} value={i.id}>{i.brand} {i.model} ({i.capacityKw}kW)</option>
            ))}
          </select>
        </div>

        {invSpec && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#64748b' }}>
            <div>Capacity: {invSpec.capacityKw}kW</div>
            <div>MPPT: {invSpec.mpptCount}</div>
            <div>Max V: {invSpec.maxInputVoltage}V</div>
            <div>String: {invSpec.minString}–{invSpec.maxString}</div>
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-section-title">MPPT Configuration</div>
        {invSpec && Array.from({ length: invSpec.mpptCount }, (_, i) => {
          const mpptStrings = inverter.strings.filter(s => s.mpptIndex === i);
          return (
            <div key={i} className="mppt-accordion">
              <div className="mppt-header">
                <span>MPPT {i + 1}</span>
                <span>{mpptStrings.length} strings</span>
              </div>
              <div className="mppt-body">
                {mpptStrings.map((str, si) => {
                  const count = str.moduleIds.length;
                  const isValid = count >= invSpec.minString && count <= invSpec.maxString;
                  return (
                    <div key={str.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span>String {si + 1}: {count} modules</span>
                      <span className={`string-badge ${isValid ? 'string-valid' : 'string-invalid'}`}>
                        {isValid ? '✓' : '✗'} {count}/{invSpec.minString}–{invSpec.maxString}
                      </span>
                    </div>
                  );
                })}
                <button className="panel-btn" style={{ marginTop: 4, fontSize: 11 }}
                  onClick={() => handleAddString(i)}>+ Add String</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-section">
        <button className="panel-btn" onClick={() => setShowWireCalc(!showWireCalc)}>
          🔌 Wire Size Calculator
        </button>

        {showWireCalc && invSpec && (
          <div style={{ marginTop: 12, padding: 12, background: '#13151d', borderRadius: 8, border: '1px solid #2a2d3a' }}>
            <div className="panel-field-row">
              <span className="panel-label">Wire Length (m)</span>
              <input type="number" className="panel-input-sm" value={wireLen}
                onChange={e => setWireLen(Number(e.target.value))} />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Cable Type</span>
              <select className="panel-select" value={cableType} onChange={e => setCableType(e.target.value as any)}
                style={{ width: 'auto' }}>
                <option value="copper">Copper</option>
                <option value="aluminium">Aluminium</option>
              </select>
            </div>
            {(() => {
              // Use first string for calculation
              const firstStr = inverter.strings[0];
              const modCount = firstStr?.moduleIds.length || 10;
              const spec0 = MODULE_DATABASE[1]; // default spec
              const result = calculateWireSize({
                stringVoltageVoc: spec0.voc * modCount,
                stringCurrentIsc: spec0.isc,
                wireLengthM: wireLen,
                cableType,
              });
              return (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                  <div className="panel-field-row">
                    <span>Min Area</span>
                    <span style={{ fontWeight: 600 }}>{result.minCrossSectionMm2} mm²</span>
                  </div>
                  <div className="panel-field-row">
                    <span>Recommended</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>{result.recommendedSizeMm2} mm²</span>
                  </div>
                  <div className="panel-field-row">
                    <span>Voltage Drop</span>
                    <span>{result.voltageDrop}V ({result.voltageDropPercent}%)</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="panel-section">
        <button className="panel-btn panel-btn-danger"
          onClick={() => store.deleteInverter(inverter.id)}>🗑 Delete Inverter</button>
      </div>
    </div>
  );
}

// ─── Dimension Panel ─────────────────────────────────────────────────────────

function DimensionPanel({ dimId, p1, p2 }: { dimId: string; p1: any; p2: any }) {
  const store = useDesignStore();
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y) / store.pxPerMeter;

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Dimension</div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{d.toFixed(2)} m</div>
          <div className="stat-label">Measured Distance</div>
        </div>
      </div>
      <div className="panel-section">
        <button className="panel-btn panel-btn-danger"
          onClick={() => store.deleteDimension(dimId)}>🗑 Delete</button>
      </div>
    </div>
  );
}

// ─── Text Block Panel ────────────────────────────────────────────────────────

function TextBlockPanel({ tb }: { tb: any }) {
  const store = useDesignStore();

  return (
    <div className="studio-right-panel">
      <div className="panel-section">
        <div className="panel-section-title">Text Block</div>
        <div className="panel-field">
          <span className="panel-label">Content</span>
          <textarea className="panel-input" rows={3} value={tb.text}
            onChange={e => store.updateTextBlock(tb.id, { text: e.target.value })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Font Size</span>
          <input type="number" className="panel-input-sm" min={8} max={72} value={tb.fontSize}
            onChange={e => store.updateTextBlock(tb.id, { fontSize: Number(e.target.value) })} />
        </div>
        <div className="panel-field-row">
          <span className="panel-label">Color</span>
          <input type="color" value={tb.color}
            onChange={e => store.updateTextBlock(tb.id, { color: e.target.value })}
            style={{ width: 40, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }} />
        </div>
      </div>
      <div className="panel-section">
        <button className="panel-btn panel-btn-primary"
          onClick={() => store.updateTextBlock(tb.id, {})}>Update</button>
        <button className="panel-btn panel-btn-danger" style={{ marginTop: 8 }}
          onClick={() => store.deleteTextBlock(tb.id)}>🗑 Delete</button>
      </div>
    </div>
  );
}
