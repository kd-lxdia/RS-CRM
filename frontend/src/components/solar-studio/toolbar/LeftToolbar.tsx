// =============================================================================
// Left Toolbar — 10 Tools with Sub-menus
// =============================================================================

import { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import type { ToolType } from '../store/types';

interface ToolDef {
  id: string;
  icon: string;
  label: string;
  tool?: ToolType;
  sub?: { icon: string; label: string; tool: ToolType }[];
}

const TOOLS: (ToolDef | 'divider')[] = [
  {
    id: 'model', icon: '⬠', label: 'Model (Roof)',
    sub: [
      { icon: '▭', label: 'Flat Roof', tool: 'model_flat' },
      { icon: '△', label: 'Pitch Roof', tool: 'model_pitch' },
      { icon: '✏', label: 'Draw Phase', tool: 'model_draw' },
    ],
  },
  {
    id: 'obstruction', icon: '⚠', label: 'Obstruction',
    sub: [
      { icon: '○', label: 'Cylinder', tool: 'obstruction_cylinder' },
      { icon: '⬠', label: 'Polygon', tool: 'obstruction_polygon' },
      { icon: '▭', label: 'Rectangle', tool: 'obstruction_rectangle' },
      { icon: '╌', label: 'Safety Line', tool: 'obstruction_safety_line' },
      { icon: '┄', label: 'Property Line', tool: 'obstruction_property_line' },
      { icon: '║', label: 'Handrail', tool: 'obstruction_handrail' },
      { icon: '▤', label: 'Walkway', tool: 'obstruction_walkway' },
      { icon: '🌳', label: 'Tree', tool: 'obstruction_tree' },
    ],
  },
  {
    id: 'module', icon: '◫', label: 'Module Tools',
    sub: [
      { icon: '+', label: 'Add Module', tool: 'module_add' },
      { icon: '−', label: 'Delete Module', tool: 'module_delete' },
      { icon: '±', label: 'Add/Delete Toggle', tool: 'module_toggle' },
    ],
  },
  { id: 'component', icon: '⚡', label: 'Component (Inverter)', tool: 'component_inverter' },
  'divider',
  { id: 'dimension', icon: '📏', label: 'Dimension', tool: 'dimension' },
  { id: 'lasso', icon: '▣', label: 'Lasso Select', tool: 'lasso' },
  { id: 'text', icon: 'T', label: 'Text Block', tool: 'text_block' },
  'divider',
  {
    id: 'analysis', icon: '☀', label: 'Solar Analysis',
    sub: [
      { icon: '🌤', label: 'Irradiance Map', tool: 'irradiance_map' },
      { icon: '☀', label: 'Solar Access', tool: 'solar_access' },
    ],
  },
  'divider',
  { id: 'select', icon: '↖', label: 'Select Tool', tool: 'select' },
];

export default function LeftToolbar() {
  const { activeTool, setActiveTool, showIrradianceMap, setShowIrradianceMap, solarAccessRun, setSolarAccessRun } = useDesignStore();
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const handleClick = (tool: ToolDef) => {
    if (tool.sub) {
      setOpenSub(openSub === tool.id ? null : tool.id);
    } else if (tool.tool) {
      setActiveTool(tool.tool);
      setOpenSub(null);
    }
  };

  const handleSubClick = (subTool: ToolType) => {
    // Handle special analysis tools
    if (subTool === 'irradiance_map') {
      setShowIrradianceMap(!showIrradianceMap);
      setOpenSub(null);
      return;
    }
    if (subTool === 'solar_access') {
      setSolarAccessRun(!solarAccessRun);
      setOpenSub(null);
      return;
    }
    
    setActiveTool(subTool);
    setOpenSub(null);
  };

  const isActive = (tool: ToolDef) => {
    if (tool.tool && tool.tool === activeTool) return true;
    if (tool.sub) {
      // Check if any sub-tool is active
      if (tool.sub.some(s => s.tool === activeTool)) return true;
      // Check for special analysis tools
      if (tool.id === 'analysis') {
        return showIrradianceMap || solarAccessRun;
      }
    }
    return false;
  };

  const isSubActive = (subTool: ToolType) => {
    if (subTool === 'irradiance_map') return showIrradianceMap;
    if (subTool === 'solar_access') return solarAccessRun;
    return activeTool === subTool;
  };

  return (
    <div className="studio-left-toolbar">
      {TOOLS.map((item, idx) => {
        if (item === 'divider') return <div key={`d-${idx}`} className="tool-divider" />;
        const tool = item as ToolDef;
        return (
          <div key={tool.id} style={{ position: 'relative' }}>
            <button
              className={`tool-btn ${isActive(tool) ? 'active' : ''}`}
              onClick={() => handleClick(tool)}
              onMouseEnter={() => setHoveredTool(tool.id)}
              onMouseLeave={() => setHoveredTool(null)}
              title={tool.label}
            >
              <span style={{ fontSize: tool.icon.length > 1 ? 14 : 18 }}>{tool.icon}</span>
            </button>

            {hoveredTool === tool.id && !openSub && (
              <div className="tool-tooltip">{tool.label}</div>
            )}

            {openSub === tool.id && tool.sub && (
              <div className="tool-submenu">
                {tool.sub.map(s => (
                  <button
                    key={s.tool}
                    className={`tool-submenu-item ${isSubActive(s.tool) ? 'active' : ''}`}
                    onClick={() => handleSubClick(s.tool)}
                    style={isSubActive(s.tool) ? { background: '#3b82f622', color: '#3b82f6' } : {}}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
