// =============================================================================
// Energy Calculation Panel
// =============================================================================

import { Info } from 'lucide-react';
import { useDesignStore } from '../store/designStore';

export default function EnergyCalculationPanel() {
  const store = useDesignStore();
  const { energyResults, subArrays, inverters } = store;

  // Count modules
  const moduleCount = subArrays.reduce((sum, sa) => sum + sa.modules.length, 0);
  const inverterCount = inverters.length;
  const optimizerCount = 0; // TODO: Add optimizer tracking

  const handleCalculate = async () => {
    // TODO: Implement full energy calculation
    // For now, show placeholder
    const systemKWp = moduleCount * 0.44; // Assuming 440W modules
    const annualGenMWh = systemKWp * 1.35; // Rough estimate
    const specGen = 1350;
    const pr = 0.82;
    const energyOffset = 85;

    store.setEnergyResults({
      calculated: true,
      lastCalculatedAt: new Date(),
      annualGenerationMWh: annualGenMWh,
      specGenKwhPerKwp: specGen,
      performanceRatio: pr,
      energyOffsetPct: energyOffset,
      systemKWp: systemKWp,
      monthlyBreakdown: Array(12).fill(annualGenMWh * 1000 / 12),
    });
  };

  const getTimeSinceCalculation = () => {
    if (!energyResults.lastCalculatedAt) return '';
    const minutes = Math.floor((Date.now() - energyResults.lastCalculatedAt.getTime()) / 60000);
    if (minutes === 0) return 'just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Module/Inverter Counts */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Module Quantity</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{moduleCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Inverter Quantity</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{inverterCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Optimizer Quantity</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{optimizerCount}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 16, marginBottom: 16 }} />

      {/* Energy Results */}
      {energyResults.calculated && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Annual Generation</span>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title="Total AC energy produced per year"
                >
                  <Info size={12} />
                </button>
              </div>
              <span style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600 }}>
                {energyResults.annualGenerationMWh.toFixed(2)} MWh
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Spec Gen</span>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title="Specific generation: kWh produced per kWp installed per year"
                >
                  <Info size={12} />
                </button>
              </div>
              <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                {energyResults.specGenKwhPerKwp.toFixed(0)} kWh/kWp/year
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Performance Ratio</span>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title="Ratio of actual to theoretical energy output"
                >
                  <Info size={12} />
                </button>
              </div>
              <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                {energyResults.performanceRatio.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Energy Offset</span>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                  title="Percentage of annual consumption covered by solar"
                >
                  <Info size={12} />
                </button>
              </div>
              <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                {energyResults.energyOffsetPct.toFixed(0)} %
              </span>
            </div>
          </div>
        </>
      )}

      {/* Calculate Button */}
      <button
        onClick={handleCalculate}
        disabled={moduleCount === 0}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'transparent',
          border: '1px solid #3b82f6',
          borderRadius: 6,
          color: moduleCount === 0 ? '#64748b' : '#3b82f6',
          fontSize: 13,
          fontWeight: 500,
          cursor: moduleCount === 0 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (moduleCount > 0) {
            e.currentTarget.style.background = '#3b82f6';
            e.currentTarget.style.color = 'white';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = moduleCount === 0 ? '#64748b' : '#3b82f6';
        }}
      >
        {energyResults.calculated ? 'Recalculate Generation' : 'Calculate Generation'}
      </button>

      {/* Last Updated */}
      {energyResults.calculated && (
        <div style={{ textAlign: 'center', marginTop: 8, color: '#64748b', fontSize: 11 }}>
          Last updated {getTimeSinceCalculation()}
        </div>
      )}
    </div>
  );
}
