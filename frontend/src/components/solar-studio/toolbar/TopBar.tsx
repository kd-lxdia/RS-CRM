// =============================================================================
// Top Bar — View Toggle, Solar Access, Save
// =============================================================================

import { useDesignStore, MODULE_DATABASE } from '../store/designStore';
import type { MountingStructureType, ViewMode } from '../store/types';
import { DEFAULT_MOUNTING_CONFIGS } from '../store/types';
import { calculateEnergyYield } from '../engine/EnergyYield';
import { calculateSolarAccessBackend } from '../engine/SolarAccessEngine';
import { resolveMountingConfig } from '../engine/MountingStructureEngine';
import { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const MOUNTING_TYPES: { value: MountingStructureType; label: string }[] = [
  { value: 'flush_roof', label: 'Flush Roof' },
  { value: 'elevated_roof', label: 'Elevated Roof' },
  { value: 'fixed_tilt_single', label: 'Fixed Tilt Single' },
  { value: 'fixed_tilt_double', label: 'Fixed Tilt Double' },
  { value: 'east_west', label: 'East-West' },
  { value: 'ballasted_roof', label: 'Ballasted' },
  { value: 'sat_single_axis', label: 'Single Axis Tracker' },
];

export default function TopBar({ onOpenLocationSelector }: { onOpenLocationSelector?: () => void }) {
  const store = useDesignStore();
  const [computing, setComputing] = useState(false);

  const views: { mode: ViewMode; label: string; shortcut: string }[] = [
    { mode: '2d', label: '2D', shortcut: '22' },
    { mode: '3d', label: '3D', shortcut: '33' },
    { mode: 'sld', label: 'SLD', shortcut: '44' },
  ];

  const totalModules = store.subArrays.reduce((s, sa) => s + sa.modules.length, 0);
  const selectedSubArray = useMemo(() => {
    if (store.selectedType !== 'module') return null;
    const selectedId = store.selectedIds[0];
    return store.subArrays.find(sa => sa.modules.some(module => module.id === selectedId)) || null;
  }, [store.selectedIds, store.selectedType, store.subArrays]);

  const structureSelectValue = useMemo(() => {
    if (selectedSubArray) return resolveMountingConfig(selectedSubArray).structureType;
    if (store.subArrays.length === 0) return 'flush_roof';
    const first = resolveMountingConfig(store.subArrays[0]).structureType;
    const allSame = store.subArrays.every(sa => resolveMountingConfig(sa).structureType === first);
    return allSame ? first : 'mixed';
  }, [selectedSubArray, store.subArrays]);

  const totalKwp = useMemo(() => {
    let kw = 0;
    for (const sa of store.subArrays) {
      const spec = MODULE_DATABASE.find(m => m.id === sa.moduleSpecId);
      if (spec) kw += sa.modules.length * spec.wattage / 1000;
    }
    return kw;
  }, [store.subArrays]);

  const handleSolarAccess = async () => {
    setComputing(true);
    // Collect all modules
    const allModules = store.subArrays.flatMap(sa => sa.modules.map(m => ({ id: m.id, x: m.x, y: m.y })));

    // Run solar access via backend (simulated)
    try {
      const lat = store.locationData?.lat || 28.6139;
      const lng = store.locationData?.lng || 77.2090;
      const result = await calculateSolarAccessBackend(allModules, store.obstructions, lat, lng, store.pxPerMeter);
      store.setSolarAccess(result);
      store.setSolarAccessRun(true);
    } catch (e) {
      console.error('Failed to calculate solar access', e);
    } finally {
      setComputing(false);
    }
  };

  const handleStructureChange = (structureType: MountingStructureType) => {
    const targets = selectedSubArray ? [selectedSubArray] : store.subArrays;
    for (const subArray of targets) {
      store.setSubArrayMounting(subArray.id, {
        ...resolveMountingConfig(subArray),
        ...DEFAULT_MOUNTING_CONFIGS[structureType],
        structureType,
        tilt: subArray.tilt,
        azimuth: subArray.azimuth,
      });
    }
  };

  const handleSolarAutoplay = () => {
    const isHourlyAutoplay = store.sunSimulation.isPlaying && store.sunSimulation.playMode === 'hour';
    store.setSunSimulation({
      enabled: true,
      isPlaying: !isHourlyAutoplay,
      playMode: 'hour',
      hour: isHourlyAutoplay ? store.sunSimulation.hour : Math.max(5, Math.min(store.sunSimulation.hour, 18)),
      minute: isHourlyAutoplay ? store.sunSimulation.minute : 0,
    });
    store.setSolarAccessRun(true);
  };

  return (
    <div className="studio-topbar">
      <div className="studio-topbar-left">
        <span className="studio-title">☀️ Solar Studio</span>
        {totalModules > 0 && (
          <>
            <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600 }}>
              {totalModules} panels
            </span>
            <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>
              {totalKwp.toFixed(1)} kWp
            </span>
          </>
        )}
        {store.isDirty && (
          <span style={{ color: '#f59e0b', fontSize: 10 }}>● unsaved</span>
        )}
      </div>

      <div className="studio-topbar-center">
        {views.map(v => (
          <button
            key={v.mode}
            className={`view-btn ${store.viewMode === v.mode ? 'active' : ''}`}
            onClick={() => store.setViewMode(v.mode)}
            title={`Press ${v.shortcut} for ${v.label}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="studio-topbar-right">
        {store.subArrays.length > 0 && (
          <select
            className="topbar-action-btn"
            value={structureSelectValue}
            onChange={e => handleStructureChange(e.target.value as MountingStructureType)}
            title={selectedSubArray ? 'Structure type for selected sub-array' : 'Structure type for all sub-arrays'}
            style={{ width: 170, background: '#111827', color: '#e5e7eb' }}
          >
            {structureSelectValue === 'mixed' && <option value="mixed" disabled>Mixed Structures</option>}
            {MOUNTING_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        )}

        <button
          className="topbar-action-btn"
          onClick={onOpenLocationSelector}
          title="Select Location from Map"
          style={{ background: '#3b82f6', color: 'white', borderColor: '#3b82f6' }}
        >
          📍 Location
        </button>
        
        <button
          className="topbar-action-btn solar-access-btn"
          onClick={handleSolarAccess}
          disabled={computing || totalModules === 0}
          title="Run Solar Access Analysis"
        >
          {computing ? '⏳ Computing...' : '☀ Solar Access'}
        </button>

        <button
          className="topbar-action-btn"
          onClick={handleSolarAutoplay}
          disabled={totalModules === 0}
          title="Autoplay solar access shadows"
          style={{
            background: store.sunSimulation.isPlaying && store.sunSimulation.playMode === 'hour' ? '#f59e0b' : '#111827',
            color: store.sunSimulation.isPlaying && store.sunSimulation.playMode === 'hour' ? '#111827' : '#e5e7eb',
            borderColor: store.sunSimulation.isPlaying && store.sunSimulation.playMode === 'hour' ? '#f59e0b' : '#2a2d3a',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {store.sunSimulation.isPlaying && store.sunSimulation.playMode === 'hour' ? <Pause size={14} /> : <Play size={14} />}
          Auto
        </button>

        <button
          className="topbar-action-btn save-btn"
          onClick={() => store.saveDesign()}
          title="Save Design (Ctrl+S)"
        >
          💾 Save
        </button>

        <button
          className="topbar-action-btn"
          onClick={() => store.undo()}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          className="topbar-action-btn"
          onClick={() => store.redo()}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>
      </div>
    </div>
  );
}
