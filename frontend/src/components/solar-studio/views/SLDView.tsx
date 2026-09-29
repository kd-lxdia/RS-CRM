// =============================================================================
// SLD View — Single-Line Diagram (SVG)
// =============================================================================

import { useMemo } from 'react';
import { useDesignStore, MODULE_DATABASE, INVERTER_DATABASE } from '../store/designStore';

export default function SLDView() {
  const store = useDesignStore();

  const diagram = useMemo(() => {
    const inverters = store.inverters;
    if (inverters.length === 0) return null;

    const elements: JSX.Element[] = [];
    const invWidth = 200;
    const invHeight = 120;
    const mpptHeight = 40;
    const startX = 60;
    let currentY = 40;

    inverters.forEach((inv, invIdx) => {
      const invSpec = INVERTER_DATABASE.find(s => s.id === inv.inverterSpecId);
      if (!invSpec) return;

      const invX = startX;
      const invY = currentY;

      // Inverter box
      elements.push(
        <g key={`inv-${inv.id}`}>
          <rect x={invX} y={invY} width={invWidth} height={invHeight}
            rx={8} fill="#1e2030" stroke="#7c3aed" strokeWidth={2} />
          <text x={invX + invWidth / 2} y={invY + 20} textAnchor="middle"
            fill="#e2e8f0" fontSize={12} fontWeight={600}>
            {invSpec.brand} {invSpec.model}
          </text>
          <text x={invX + invWidth / 2} y={invY + 36} textAnchor="middle"
            fill="#94a3b8" fontSize={10}>
            {invSpec.capacityKw}kW · {invSpec.mpptCount} MPPT
          </text>

          {/* AC output */}
          <line x1={invX + invWidth} y1={invY + invHeight / 2}
            x2={invX + invWidth + 80} y2={invY + invHeight / 2}
            stroke="#10b981" strokeWidth={2} />
          <text x={invX + invWidth + 40} y={invY + invHeight / 2 - 8}
            textAnchor="middle" fill="#10b981" fontSize={9}>AC Output</text>
          <rect x={invX + invWidth + 80} y={invY + invHeight / 2 - 15}
            width={60} height={30} rx={4} fill="#10b98122" stroke="#10b981" strokeWidth={1} />
          <text x={invX + invWidth + 110} y={invY + invHeight / 2 + 4}
            textAnchor="middle" fill="#10b981" fontSize={10}>Grid</text>
        </g>
      );

      // MPPT boxes with strings
      let stringX = invX - 30;
      let mpptY = invY + invHeight + 30;

      for (let mppt = 0; mppt < invSpec.mpptCount; mppt++) {
        const mpptStrings = inv.strings.filter(s => s.mpptIndex === mppt);
        const mpptX = startX + mppt * 160;

        // MPPT box
        elements.push(
          <g key={`mppt-${inv.id}-${mppt}`}>
            <rect x={mpptX} y={mpptY} width={140} height={mpptHeight}
              rx={6} fill="#13151d" stroke="#3b82f6" strokeWidth={1.5} />
            <text x={mpptX + 70} y={mpptY + 16} textAnchor="middle"
              fill="#3b82f6" fontSize={11} fontWeight={500}>
              MPPT {mppt + 1}
            </text>
            <text x={mpptX + 70} y={mpptY + 30} textAnchor="middle"
              fill="#64748b" fontSize={9}>
              {mpptStrings.length} strings
            </text>

            {/* Connection line to inverter */}
            <line x1={mpptX + 70} y1={mpptY} x2={invX + invWidth / 2} y2={invY + invHeight}
              stroke="#3b82f644" strokeWidth={1} strokeDasharray="4 2" />
          </g>
        );

        // Strings
        mpptStrings.forEach((str, si) => {
          const strY = mpptY + mpptHeight + 20 + si * 50;
          const modCount = str.moduleIds.length;
          const isValid = modCount >= invSpec.minString && modCount <= invSpec.maxString;

          // Find module spec
          let modSpec = MODULE_DATABASE[1];
          for (const sa of store.subArrays) {
            const foundMod = sa.modules.find(m => str.moduleIds.includes(m.id));
            if (foundMod) {
              modSpec = MODULE_DATABASE.find(ms => ms.id === sa.moduleSpecId) || modSpec;
              break;
            }
          }

          elements.push(
            <g key={`str-${str.id}`}>
              {/* String line */}
              <line x1={mpptX + 70} y1={mpptY + mpptHeight}
                x2={mpptX + 70} y2={strY}
                stroke={isValid ? '#22c55e' : '#ef4444'} strokeWidth={1.5} />

              {/* String box */}
              <rect x={mpptX + 10} y={strY} width={120} height={36}
                rx={4} fill={isValid ? '#22c55e11' : '#ef444411'}
                stroke={isValid ? '#22c55e' : '#ef4444'} strokeWidth={1} />
              <text x={mpptX + 70} y={strY + 15} textAnchor="middle"
                fill={isValid ? '#22c55e' : '#ef4444'} fontSize={10} fontWeight={500}>
                String {si + 1}: {modCount} modules
              </text>
              <text x={mpptX + 70} y={strY + 28} textAnchor="middle"
                fill="#64748b" fontSize={9}>
                {(modSpec.voc * modCount).toFixed(0)}V · {modSpec.isc}A
                {str.wireSize ? ` · ${str.wireSize}mm²` : ''}
              </text>
            </g>
          );
        });
      }

      currentY = mpptY + mpptHeight + 20 + Math.max(...[0, ...Array.from({ length: invSpec.mpptCount }, (_, m) =>
        inv.strings.filter(s => s.mpptIndex === m).length
      )]) * 50 + 60;
    });

    return elements;
  }, [store.inverters, store.subArrays]);

  const handleExport = () => {
    const svgEl = document.getElementById('sld-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'single_line_diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studio-canvas-area" style={{ background: '#0f1117', overflow: 'auto' }}>
      {/* Export button */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 30,
        display: 'flex', gap: 8,
      }}>
        <button className="topbar-action-btn" onClick={handleExport}>
          📥 Export SVG
        </button>
      </div>

      {store.inverters.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#64748b', fontSize: 14,
        }}>
          No inverters placed. Add an inverter to generate the SLD.
        </div>
      ) : (
        <svg id="sld-svg" width="100%" height="100%" viewBox="0 0 900 800"
          style={{ minHeight: '100%' }}>
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#64748b" />
            </marker>
          </defs>

          {/* Title */}
          <text x={450} y={24} textAnchor="middle" fill="#e2e8f0" fontSize={16} fontWeight={700}>
            Single Line Diagram (SLD)
          </text>

          {diagram}
        </svg>
      )}
    </div>
  );
}
