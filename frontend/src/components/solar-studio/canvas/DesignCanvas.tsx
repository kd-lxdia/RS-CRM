// =============================================================================
// Design Canvas — Konva Stage with all layers
// =============================================================================

import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Arrow, Image as KonvaImage, Ellipse } from 'react-konva';
import { useDesignStore, MODULE_DATABASE, INVERTER_DATABASE } from '../store/designStore';
import type { Point2D, DesignRoof, DesignObstruction, DesignSubArray, ToolType } from '../store/types';
import { uid, distance, isNearPoint, polygonArea, insetPolygon, getMercatorMetersPerPixel } from '../utils/geometry';
import { irradianceAccessColor, solarAccessColor } from '../engine/SolarAccessEngine';
import { runPlacement, autoRowSpacingPx } from '../engine/PlacementEngine';
import {
  calculateShadowVector,
  calculateCylinderShadow,
  calculatePolygonShadow,
  calculateTreeShadow,
} from '../../../utils/solar-calculations';
import Konva from 'konva';

const GRID_SIZE = 20;
const ROOF_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DesignCanvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const store = useDesignStore();

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // ─── Pan state ──────────────────────────────────────────────────────────────
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point2D | null>(null);

  // ─── Keyboard state for spacebar panning ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !store.isDrawing) {
        e.preventDefault();
        setIsPanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsPanning(false);
        setPanStart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [store.isDrawing]);

  // ─── Click Handler (delegated by tool) ─────────────────────────────────────

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Adjust for stage position/scale  
    const scale = store.canvasScale;
    const offset = store.canvasOffset;
    const x = (pos.x - offset.x) / scale;
    const y = (pos.y - offset.y) / scale;
    const point: Point2D = { x, y };

    const tool = store.activeTool;

    // ─── SELECT TOOL ─────────────────────────────────────────────────
    if (tool === 'select') {
      // Check if we clicked on any object
      const target = e.target;
      const id = target.attrs?.id;
      if (id && id !== 'stage-bg') {
        const type = target.attrs?.['data-type'] || 'unknown';
        if (e.evt.shiftKey) {
          // Multi-select
          store.selectObjects([...store.selectedIds, id], type);
        } else {
          store.selectObjects([id], type);
        }
      } else {
        store.clearSelection();
      }
      return;
    }

    // ─── ROOF DRAWING TOOLS ──────────────────────────────────────────
    if (tool === 'model_flat' || tool === 'model_pitch' || tool === 'model_draw') {
      if (!store.isDrawing) {
        store.setIsDrawing(true);
        store.addDrawingVertex(point);
      } else {
        // Check if closing (clicking near first vertex)
        if (store.drawingVertices.length >= 3 && isNearPoint(point, store.drawingVertices[0], 15 / scale)) {
          finishRoof();
        } else {
          store.addDrawingVertex(point);
        }
      }
      return;
    }

    // ─── OBSTRUCTION TOOLS ───────────────────────────────────────────
    if (tool.startsWith('obstruction_')) {
      handleObstructionClick(tool, point, e);
      return;
    }

    // ─── MODULE ADD ──────────────────────────────────────────────────
    if (tool === 'module_add') {
      handleAddModule(point);
      return;
    }

    // ─── MODULE DELETE ───────────────────────────────────────────────
    if (tool === 'module_delete') {
      const target = e.target;
      const id = target.attrs?.id;
      if (id && target.attrs?.['data-type'] === 'module') {
        store.deleteModules([id]);
      }
      return;
    }

    // ─── DIMENSION TOOL ──────────────────────────────────────────────
    if (tool === 'dimension') {
      if (!store.isDrawing) {
        store.setIsDrawing(true);
        store.addDrawingVertex(point);
      } else {
        const p1 = store.drawingVertices[0];
        store.addDimension({ id: uid(), p1, p2: point });
        store.clearDrawing();
      }
      return;
    }

    // ─── TEXT BLOCK ──────────────────────────────────────────────────
    if (tool === 'text_block') {
      store.addTextBlock({
        id: uid(),
        x: point.x,
        y: point.y,
        text: 'Text',
        fontSize: 14,
        color: '#e2e8f0',
      });
      return;
    }

    // ─── INVERTER ────────────────────────────────────────────────────
    if (tool === 'component_inverter') {
      const defaultSpec = INVERTER_DATABASE[3]; // Growatt 10kW
      store.addInverter({
        id: uid(),
        inverterSpecId: defaultSpec.id,
        x: point.x,
        y: point.y,
        quantity: 1,
        strings: [],
      });
      return;
    }

    // ─── LASSO ───────────────────────────────────────────────────────
    if (tool === 'lasso') {
      if (!store.isDrawing) {
        store.setIsDrawing(true);
        store.addDrawingVertex(point);
      }
      return;
    }
  }, [store]);

  // ─── Mouse move for lasso drag and panning ─────────────────────────────────

  const [lassoEnd, setLassoEnd] = useState<Point2D | null>(null);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const x = (pos.x - store.canvasOffset.x) / store.canvasScale;
    const y = (pos.y - store.canvasOffset.y) / store.canvasScale;

    // Update cursor position in store (meters)
    store.updateCursorPosition(
      Math.round(x / store.pxPerMeter * 100) / 100,
      Math.round(y / store.pxPerMeter * 100) / 100,
      0
    );

    // Lasso selection
    if (store.activeTool === 'lasso' && store.isDrawing) {
      setLassoEnd({ x, y });
    }

    // Spacebar or middle mouse panning
    if (isPanning && panStart) {
      const dx = pos.x - panStart.x;
      const dy = pos.y - panStart.y;
      store.setCanvasOffset({
        x: store.canvasOffset.x + dx,
        y: store.canvasOffset.y + dy,
      });
      setPanStart(pos);
    }
  }, [store.activeTool, store.isDrawing, store.canvasOffset, store.canvasScale, store.pxPerMeter, isPanning, panStart]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Middle mouse button or spacebar for panning
    if (e.evt.button === 1 || isPanning) {
      e.evt.preventDefault();
      setIsPanning(true);
      setPanStart(pos);
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    // Lasso selection
    if (store.activeTool === 'lasso' && store.isDrawing && lassoEnd && store.drawingVertices.length > 0) {
      const p1 = store.drawingVertices[0];
      const p2 = lassoEnd;
      const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);

      // Find all modules fully inside
      const selected: string[] = [];
      for (const sa of store.subArrays) {
        for (const mod of sa.modules) {
          if (mod.x >= minX && mod.x <= maxX && mod.y >= minY && mod.y <= maxY) {
            selected.push(mod.id);
          }
        }
      }
      if (selected.length > 0) {
        store.selectObjects(selected, 'module');
      }
      store.clearDrawing();
      setLassoEnd(null);
    }

    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
  }, [store, lassoEnd, isPanning]);

  // ─── Close polygon listener ────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      if (store.isDrawing && store.activeTool.startsWith('model_')) {
        finishRoof();
      } else if (store.isDrawing && store.activeTool.startsWith('obstruction_')) {
        finishObstruction();
      }
    };
    window.addEventListener('studio:close-polygon', handler);
    return () => window.removeEventListener('studio:close-polygon', handler);
  }, [store.isDrawing, store.drawingVertices, store.activeTool]);

  // ─── Double-click toggle 3D ────────────────────────────────────────────────

  const handleDblClick = useCallback(() => {
    store.setViewMode(store.viewMode === '3d' ? '2d' : '3d');
  }, [store.viewMode]);

  // ─── Finish Drawing Helpers ────────────────────────────────────────────────

  const finishRoof = () => {
    if (store.drawingVertices.length < 3) return;
    const colorIdx = store.roofs.length % ROOF_COLORS.length;
    const roof: DesignRoof = {
      id: uid(),
      name: `Roof ${store.roofs.length + 1}`,
      vertices: [...store.drawingVertices],
      height: 3,
      parapetHeight: 0.3,
      tilt: 10,
      azimuth: 180,
      setbacks: { n: 0.5, e: 0.5, s: 0.5, w: 0.5 },
      flashType: false,
      baseHeight: 0,
      templateType: 'tilted_mount',
      structureType: 'default',
      color: ROOF_COLORS[colorIdx],
    };
    store.addRoof(roof);
    store.clearDrawing();
    store.selectObjects([roof.id], 'roof');
  };

  const finishObstruction = () => {
    if (store.drawingVertices.length < 2) return;
    const tool = store.activeTool;
    const roofId = store.roofs.length > 0 ? store.roofs[store.roofs.length - 1].id : '';

    let type: DesignObstruction['type'] = 'polygon';
    if (tool === 'obstruction_safety_line') type = 'safety_line';
    else if (tool === 'obstruction_property_line') type = 'property_line';
    else if (tool === 'obstruction_handrail') type = 'handrail';
    else if (tool === 'obstruction_polygon') type = 'polygon';

    const obs: DesignObstruction = {
      id: uid(),
      type,
      roofId,
      vertices: [...store.drawingVertices],
      height: type === 'handrail' ? 0.9 : 0.6,
    };
    store.addObstruction(obs);
    store.clearDrawing();
    store.selectObjects([obs.id], 'obstruction');
  };

  const handleObstructionClick = (tool: ToolType, point: Point2D, e: any) => {
    const roofId = store.roofs.length > 0 ? store.roofs[store.roofs.length - 1].id : '';

    if (tool === 'obstruction_cylinder') {
      store.addObstruction({
        id: uid(), type: 'cylinder', roofId,
        vertices: [], center: point, radius: 15, height: 0.6,
      });
      return;
    }

    if (tool === 'obstruction_rectangle') {
      if (!store.isDrawing) {
        store.setIsDrawing(true);
        store.addDrawingVertex(point);
      } else {
        const p1 = store.drawingVertices[0];
        const obs: DesignObstruction = {
          id: uid(), type: 'rectangle', roofId,
          vertices: [
            p1, { x: point.x, y: p1.y },
            point, { x: p1.x, y: point.y },
          ],
          height: 0.6,
        };
        store.addObstruction(obs);
        store.clearDrawing();
        store.selectObjects([obs.id], 'obstruction');
      }
      return;
    }

    if (tool === 'obstruction_walkway') {
      if (!store.isDrawing) {
        store.setIsDrawing(true);
        store.addDrawingVertex(point);
      } else {
        const p1 = store.drawingVertices[0];
        const obs: DesignObstruction = {
          id: uid(), type: 'walkway', roofId,
          vertices: [
            p1, { x: point.x, y: p1.y },
            point, { x: p1.x, y: point.y },
          ],
          height: 0, width: Math.abs(point.x - p1.x) / store.pxPerMeter,
        };
        store.addObstruction(obs);
        store.clearDrawing();
      }
      return;
    }

    if (tool === 'obstruction_tree') {
      const newId = uid();
      store.addObstruction({
        id: newId, type: 'tree', roofId,
        vertices: [], center: point, height: 5,
        trunkHeight: 3, crownHeight: 4, crownRadius: 2.5,
        treeModel: 'oak',
      });
      store.setActiveTool('select');
      store.selectObjects([newId], 'obstruction');
      return;
    }

    // Polygon / line types: add vertices
    if (!store.isDrawing) {
      store.setIsDrawing(true);
      store.addDrawingVertex(point);
    } else {
      if (store.drawingVertices.length >= 2 && isNearPoint(point, store.drawingVertices[0], 15 / store.canvasScale)) {
        finishObstruction();
      } else {
        store.addDrawingVertex(point);
      }
    }
  };

  const handleAddModule = (point: Point2D) => {
    // Add a single module to the first sub-array or create one
    const defaultSpec = MODULE_DATABASE[1]; // Waaree 540W
    let sa = store.subArrays[0];
    if (!sa) {
      const roofId = store.roofs[0]?.id || '';
      sa = {
        id: uid(), roofId, moduleSpecId: defaultSpec.id,
        modules: [], tilt: 10, azimuth: 180, mountHeight: 0.15,
        rowSpacing: 1.5, rowSpacingMode: 'auto', orientation: 'portrait',
        tableRows: 2, tableCols: 3, vSpacing: 0.02, hSpacing: 0.02,
        tableSpacing: 0.5, templateType: 'tilted_mount', structureType: 'default',
      };
      store.addSubArray(sa);
    }

    const mod = {
      id: uid(), subArrayId: sa.id,
      x: point.x, y: point.y, row: 0, col: 0,
    };
    store.addModuleToSubArray(sa.id, mod);
  };

  // ─── Zoom / Pan ────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = store.canvasScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const mousePointTo = {
      x: (pointer.x - store.canvasOffset.x) / oldScale,
      y: (pointer.y - store.canvasOffset.y) / oldScale,
    };

    store.setCanvasScale(clampedScale);
    store.setCanvasOffset({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [store]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isDrawingTool = store.activeTool.startsWith('model_') || store.activeTool.startsWith('obstruction_');
  const drawingHint = store.isDrawing
    ? 'Click to place vertices · Enter to close · Esc to cancel'
    : isDrawingTool ? 'Click on canvas to start drawing' : '';

  return (
    <div className="studio-canvas-area" ref={containerRef}>
      {drawingHint && <div className="drawing-hint">{drawingHint}</div>}

      {/* Solar access legend */}
      {store.solarAccessRun && !store.irradianceMap.enabled && (
        <div className="solar-access-legend">
          {[
            { label: '<50%', color: '#dc2626' },
            { label: '50-65%', color: '#ea580c' },
            { label: '65-75%', color: '#eab308' },
            { label: '75-85%', color: '#84cc16' },
            { label: '85-95%', color: '#22c55e' },
            { label: '>95%', color: '#16a34a' },
          ].map(s => (
            <span key={s.label} className="sa-swatch">
              <span className="sa-swatch-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Irradiance map legend — bottom left gradient bar */}
      {store.irradianceMap.enabled && (
        <div style={{
          position: 'absolute', bottom: 44, left: 16, zIndex: 30,
          background: '#1a1d27cc', backdropFilter: 'blur(8px)',
          border: '1px solid #2a2d3a', borderRadius: 8, padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>
            ☀ Irradiance Map
          </div>
          <div style={{
            width: 140, height: 10, borderRadius: 4,
            background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
            <span>Low</span><span>Medium</span><span>High</span>
          </div>
        </div>
      )}

      {/* Compass rose — top right */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 30,
        width: 48, height: 48,
        background: '#1a1d27cc', backdropFilter: 'blur(8px)',
        border: '1px solid #2a2d3a', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          {/* N arrow */}
          <polygon points="20,4 17,20 20,18 23,20" fill="#ef4444" />
          {/* S arrow */}
          <polygon points="20,36 17,20 20,22 23,20" fill="#94a3b8" />
          {/* E/W ticks */}
          <line x1="4" y1="20" x2="8" y2="20" stroke="#64748b" strokeWidth="1.5" />
          <line x1="32" y1="20" x2="36" y2="20" stroke="#64748b" strokeWidth="1.5" />
          {/* Center dot */}
          <circle cx="20" cy="20" r="2" fill="#e2e8f0" />
          {/* Labels */}
          <text x="20" y="3" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="bold">N</text>
          <text x="20" y="40" textAnchor="middle" fontSize="7" fill="#94a3b8">S</text>
          <text x="1" y="23" textAnchor="middle" fontSize="7" fill="#94a3b8">W</text>
          <text x="39" y="23" textAnchor="middle" fontSize="7" fill="#94a3b8">E</text>
        </svg>
      </div>




      <Stage
        ref={stageRef}
        width={dims.w}
        height={dims.h}
        scaleX={store.canvasScale}
        scaleY={store.canvasScale}
        x={store.canvasOffset.x}
        y={store.canvasOffset.y}
        draggable={store.activeTool === 'select' && !isPanning}
        onClick={handleStageClick}
        onDblClick={handleDblClick}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDragEnd={(e) => {
          store.setCanvasOffset({ x: e.target.x(), y: e.target.y() });
        }}
        style={{ cursor: isPanning ? 'grabbing' : 'default', position: 'relative', zIndex: 1 }}
      >
        {/* Grid layer */}
        <Layer listening={false}>
          {Array.from({ length: Math.ceil(dims.w / store.canvasScale / GRID_SIZE) + 40 }, (_, i) => (
            <Line
              key={`gv-${i}`}
              points={[(i - 20) * GRID_SIZE, -20 * GRID_SIZE, (i - 20) * GRID_SIZE, (Math.ceil(dims.h / store.canvasScale / GRID_SIZE) + 20) * GRID_SIZE]}
              stroke="#1e2030"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: Math.ceil(dims.h / store.canvasScale / GRID_SIZE) + 40 }, (_, i) => (
            <Line
              key={`gh-${i}`}
              points={[-20 * GRID_SIZE, (i - 20) * GRID_SIZE, (Math.ceil(dims.w / store.canvasScale / GRID_SIZE) + 20) * GRID_SIZE, (i - 20) * GRID_SIZE]}
              stroke="#1e2030"
              strokeWidth={0.5}
            />
          ))}
        </Layer>

        {/* Satellite image layer — inside Konva, perfectly synced with canvas */}
        {store.locationData && (
          <SatelliteKonvaLayer
            lat={store.locationData.lat}
            lng={store.locationData.lng}
            pxPerMeter={store.pxPerMeter}
          />
        )}

        {/* Roofs layer */}
        <Layer>
          {store.roofs.map(roof => {
            const flat = roof.vertices.flatMap(v => [v.x, v.y]);
            const isSelected = store.selectedIds.includes(roof.id);
            return (
              <Group key={roof.id}>
                <Line
                  id={roof.id}
                  data-type="roof"
                  points={flat}
                  closed
                  fill={roof.color + '22'}
                  stroke={isSelected ? '#fbbf24' : roof.color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  hitStrokeWidth={10}
                />
                {/* Setback lines */}
                {store.layers.setbackLines && roof.vertices.length >= 3 && (() => {
                  const avg = (roof.setbacks.n + roof.setbacks.e + roof.setbacks.s + roof.setbacks.w) / 4;
                  const insetPts = insetPolygon(roof.vertices, avg * store.pxPerMeter);
                  if (insetPts.length < 3) return null;
                  return (
                    <Line
                      points={insetPts.flatMap((v: Point2D) => [v.x, v.y])}
                      closed
                      stroke="#f59e0b44"
                      strokeWidth={1}
                      dash={[6, 4]}
                      listening={false}
                    />
                  );
                })()}
                {/* Roof label */}
                <Text
                  x={roof.vertices[0]?.x || 0}
                  y={(roof.vertices[0]?.y || 0) - 16}
                  text={roof.name}
                  fontSize={11}
                  fill={roof.color}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Obstructions layer */}
        <Layer>
          {store.obstructions.map(obs => {
            const isSelected = store.selectedIds.includes(obs.id);
            const strokeColor = isSelected ? '#fbbf24' : '#ef4444';

            if (obs.type === 'cylinder' && obs.center) {
              return (
                <Circle
                  key={obs.id}
                  id={obs.id}
                  data-type="obstruction"
                  x={obs.center.x}
                  y={obs.center.y}
                  radius={obs.radius || 15}
                  fill="#ef444433"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  draggable
                  onDragEnd={(e) => {
                    store.updateObstruction(obs.id, {
                      center: { x: e.target.x(), y: e.target.y() },
                    });
                  }}
                />
              );
            }

            if (obs.type === 'tree' && obs.center) {
              const crownR = (obs.crownRadius || 2.5) * store.pxPerMeter;
              return (
                <Group key={obs.id} x={obs.center.x} y={obs.center.y} draggable
                  onDragEnd={(e) => {
                    store.updateObstruction(obs.id, {
                      center: { x: e.target.x(), y: e.target.y() },
                    });
                  }}
                >
                  <Circle radius={crownR} fill="#16a34a33" stroke={isSelected ? '#fbbf24' : '#16a34a'} strokeWidth={isSelected ? 3 : 1.5}
                    id={obs.id} data-type="obstruction" />
                  <Circle radius={crownR * 0.35} fill="#8b6b4a55" stroke="#8b6b4a" strokeWidth={1} />
                  {store.layers.obstructionLabels && (
                    <Text text={`🌳 ${obs.treeModel || 'tree'}`} fontSize={9} fill="#16a34a" y={-crownR - 12} x={-20} listening={false} />
                  )}
                </Group>
              );
            }

            if (obs.type === 'walkway' && obs.vertices.length >= 4) {
              const flat = obs.vertices.flatMap(v => [v.x, v.y]);
              return (
                <Group key={obs.id}>
                  <Line id={obs.id} data-type="obstruction" points={flat} closed
                    fill="#f59e0b22" stroke="#f59e0b" strokeWidth={1} dash={[4, 4]} />
                  {/* Hatching */}
                  {(() => {
                    const minX = Math.min(...obs.vertices.map(v => v.x));
                    const maxX = Math.max(...obs.vertices.map(v => v.x));
                    const minY = Math.min(...obs.vertices.map(v => v.y));
                    const maxY = Math.max(...obs.vertices.map(v => v.y));
                    const lines: JSX.Element[] = [];
                    for (let x = minX; x < maxX; x += 8) {
                      lines.push(
                        <Line key={`h-${obs.id}-${x}`} points={[x, minY, x + 8, maxY]}
                          stroke="#f59e0b22" strokeWidth={0.5} listening={false} />
                      );
                    }
                    return lines;
                  })()}
                </Group>
              );
            }

            if (obs.type === 'safety_line' || obs.type === 'property_line') {
              const flat = obs.vertices.flatMap(v => [v.x, v.y]);
              return (
                <Line key={obs.id} id={obs.id} data-type="obstruction"
                  points={flat} stroke={strokeColor} strokeWidth={1.5}
                  dash={[8, 4]} hitStrokeWidth={10} />
              );
            }

            if (obs.type === 'handrail') {
              const flat = obs.vertices.flatMap(v => [v.x, v.y]);
              const isSelected = store.selectedIds.includes(obs.id);
              return (
                <Line key={obs.id} id={obs.id} data-type="obstruction"
                  points={flat} stroke={isSelected ? '#fbbf24' : '#eab308'} strokeWidth={3} hitStrokeWidth={10} />
              );
            }

            // Polygon / Rectangle
            if (obs.vertices.length >= 3) {
              const flat = obs.vertices.flatMap(v => [v.x, v.y]);
              return (
                <Line key={obs.id} id={obs.id} data-type="obstruction"
                  points={flat} closed fill="#ef444422" stroke={strokeColor}
                  strokeWidth={1.5} hitStrokeWidth={10} />
              );
            }

            return null;
          })}
        </Layer>

        {/* Shadow layer — rendered below modules */}
        {store.sunSimulation.enabled && store.sunSimulation.sunElevation > 0 && (
          <Layer listening={false}>
            {store.obstructions.map(obs => {
              const metersPerPixel = 1 / store.pxPerMeter;
              const obstructionHeight = obs.type === 'tree'
                ? (obs.trunkHeight || 3) + (obs.crownHeight || 4)
                : obs.height || 1.5;
              const shadowVec = calculateShadowVector(
                { azimuth: store.sunSimulation.sunAzimuth, elevation: store.sunSimulation.sunElevation, declination: 0, hourAngle: 0, isAboveHorizon: true },
                obstructionHeight,
                metersPerPixel
              );
              if (shadowVec.length === 0) return null;

              if (obs.type === 'cylinder' && obs.center) {
                const pts = calculateCylinderShadow(obs.center.x, obs.center.y, obs.radius || 15, shadowVec);
                if (pts.length === 0) return null;
                return (
                  <Line key={`sh-${obs.id}`} points={pts} closed
                    fill="#00000055" stroke="transparent" strokeWidth={0} />
                );
              }

              if (obs.type === 'tree' && obs.center) {
                const treeShadow = calculateTreeShadow(
                  obs.center.x, obs.center.y,
                  (obs.trunkHeight || 3) * store.pxPerMeter,
                  (obs.crownRadius || 2.5) * store.pxPerMeter,
                  (obs.crownHeight || 4) * store.pxPerMeter,
                  shadowVec,
                  { azimuth: store.sunSimulation.sunAzimuth, elevation: store.sunSimulation.sunElevation, declination: 0, hourAngle: 0, isAboveHorizon: true }
                );
                if (treeShadow.radiusX === 0) return null;
                return (
                  <Ellipse key={`sh-${obs.id}`}
                    x={treeShadow.centerX} y={treeShadow.centerY}
                    radiusX={treeShadow.radiusX} radiusY={treeShadow.radiusY}
                    rotation={store.sunSimulation.sunAzimuth}
                    fill="#00000055" stroke="transparent" />
                );
              }

              if (obs.vertices.length >= 2) {
                const flat = obs.vertices.flatMap(v => [v.x, v.y]);
                const pts = calculatePolygonShadow(flat, obs.height || 0.6, shadowVec);
                if (pts.length === 0) return null;
                return (
                  <Line key={`sh-${obs.id}`} points={pts} closed
                    fill="#00000055" stroke="transparent" strokeWidth={0} />
                );
              }

              return null;
            })}
          </Layer>
        )}

        {/* Modules layer */}
        <Layer>
          {store.subArrays.map(sa => {
            const spec = MODULE_DATABASE.find(m => m.id === sa.moduleSpecId);
            if (!spec) return null;
            let mw = spec.widthMm / 1000 * store.pxPerMeter;
            let mh = spec.lengthMm / 1000 * store.pxPerMeter;
            if (sa.orientation === 'landscape') [mw, mh] = [mh, mw];

            return sa.modules.map(mod => {
              const isSelected = store.selectedIds.includes(mod.id);
              const solarPct = store.solarAccess[mod.id];
              // Irradiance map takes priority over solar access coloring
              const fill = store.irradianceMap.enabled && solarPct !== undefined
                ? irradianceAccessColor(solarPct)
                : store.solarAccessRun && solarPct !== undefined
                  ? solarAccessColor(solarPct)
                  : '#1e3a5f';
              return (
                <Rect
                  key={mod.id}
                  id={mod.id}
                  data-type="module"
                  x={mod.x}
                  y={mod.y}
                  offsetX={mw / 2}
                  offsetY={mh / 2}
                  width={mw}
                  height={mh}
                  rotation={sa.azimuth - 180}
                  fill={fill}
                  stroke={isSelected ? '#fbbf24' : '#3b82f6'}
                  strokeWidth={isSelected ? 2 : 0.5}
                  cornerRadius={1}
                />
              );
            });
          })}
        </Layer>

        {/* Strings layer */}
        {store.layers.stringing && (
          <Layer listening={false}>
            {store.inverters.map(inv => {
              const invSpec = INVERTER_DATABASE.find(s => s.id === inv.inverterSpecId);
              return inv.strings.map((str, si) => {
                const modulePositions: Point2D[] = [];
                for (const modId of str.moduleIds) {
                  for (const sa of store.subArrays) {
                    const mod = sa.modules.find(m => m.id === modId);
                    if (mod) modulePositions.push({ x: mod.x, y: mod.y });
                  }
                }
                if (modulePositions.length < 2) return null;
                const flat = modulePositions.flatMap(p => [p.x, p.y]);
                const isValid = invSpec ? str.moduleIds.length >= invSpec.minString && str.moduleIds.length <= invSpec.maxString : true;
                return (
                  <Line
                    key={`${inv.id}-s${si}`}
                    points={flat}
                    stroke={isValid ? '#22c55e' : '#ef4444'}
                    strokeWidth={1.5}
                    opacity={0.7}
                  />
                );
              });
            })}
          </Layer>
        )}

        {/* Inverters layer */}
        <Layer>
          {store.inverters.map(inv => {
            const invSpec = INVERTER_DATABASE.find(s => s.id === inv.inverterSpecId);
            const isSelected = store.selectedIds.includes(inv.id);
            return (
              <Group key={inv.id} x={inv.x} y={inv.y} draggable
                onDragEnd={(e) => {
                  store.updateInverter(inv.id, { x: e.target.x(), y: e.target.y() });
                }}
              >
                <Rect
                  id={inv.id}
                  data-type="inverter"
                  width={30}
                  height={30}
                  offsetX={15}
                  offsetY={15}
                  fill="#7c3aed33"
                  stroke={isSelected ? '#fbbf24' : '#7c3aed'}
                  strokeWidth={isSelected ? 2 : 1.5}
                  cornerRadius={4}
                />
                <Text text="⚡" fontSize={14} offsetX={7} offsetY={7} listening={false} />
                <Text text={invSpec?.model || 'INV'} fontSize={8} fill="#a78bfa" y={18} offsetX={15} width={30} align="center" listening={false} />
              </Group>
            );
          })}
        </Layer>

        {/* Dimension lines */}
        <Layer listening={false}>
          {store.dimensions.map(dim => {
            const d = distance(dim.p1, dim.p2);
            const distM = d / store.pxPerMeter;
            const midX = (dim.p1.x + dim.p2.x) / 2;
            const midY = (dim.p1.y + dim.p2.y) / 2;
            return (
              <Group key={dim.id}>
                <Line
                  id={dim.id}
                  data-type="dimension"
                  points={[dim.p1.x, dim.p1.y, dim.p2.x, dim.p2.y]}
                  stroke="#f59e0b"
                  strokeWidth={1}
                />
                <Circle x={dim.p1.x} y={dim.p1.y} radius={3} fill="#f59e0b" />
                <Circle x={dim.p2.x} y={dim.p2.y} radius={3} fill="#f59e0b" />
                <Text
                  x={midX - 20}
                  y={midY - 14}
                  text={`${distM.toFixed(2)} m`}
                  fontSize={10}
                  fill="#f59e0b"
                  fontStyle="bold"
                />
              </Group>
            );
          })}
        </Layer>

        {/* Text blocks */}
        <Layer>
          {store.textBlocks.map(tb => {
            const isSelected = store.selectedIds.includes(tb.id);
            return (
              <Text
                key={tb.id}
                id={tb.id}
                data-type="textBlock"
                x={tb.x}
                y={tb.y}
                text={tb.text}
                fontSize={tb.fontSize}
                fill={tb.color}
                draggable
                fontStyle={isSelected ? 'bold' : 'normal'}
                onDragEnd={(e) => {
                  store.updateTextBlock(tb.id, { x: e.target.x(), y: e.target.y() });
                }}
              />
            );
          })}
        </Layer>

        {/* Drawing preview */}
        {store.drawingVertices.length > 0 && (
          <Layer listening={false}>
            <Line
              points={store.drawingVertices.flatMap(v => [v.x, v.y])}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[6, 3]}
            />
            {store.drawingVertices.map((v, i) => (
              <Circle key={i} x={v.x} y={v.y} radius={4} fill="#3b82f6" stroke="white" strokeWidth={1} />
            ))}
          </Layer>
        )}

        {/* Lasso selection box */}
        {store.isDrawing && store.activeTool === 'lasso' && lassoEnd && store.drawingVertices.length > 0 && (
          <Layer listening={false}>
            <Rect
              x={Math.min(store.drawingVertices[0].x, lassoEnd.x)}
              y={Math.min(store.drawingVertices[0].y, lassoEnd.y)}
              width={Math.abs(lassoEnd.x - store.drawingVertices[0].x)}
              height={Math.abs(lassoEnd.y - store.drawingVertices[0].y)}
              fill="#3b82f611"
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Layer>
        )}
      </Stage>

      {/* Bottom bar — Map Source, 3D Source, Dual Map, Resize + coordinate display */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1a1d27ee', borderTop: '1px solid #2a2d3a',
        padding: '4px 12px', gap: 8,
      }}>
        {/* Left: map source buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(['satellite', 'hybrid', 'roadmap'] as const).map(src => (
            <button
              key={src}
              onClick={() => store.setCanvasUI({ mapSource: src })}
              style={{
                padding: '3px 8px', borderRadius: 4, border: '1px solid',
                fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
                background: store.canvasUI.mapSource === src ? '#3b82f6' : 'transparent',
                borderColor: store.canvasUI.mapSource === src ? '#2563eb' : '#2a2d3a',
                color: store.canvasUI.mapSource === src ? 'white' : '#64748b',
              }}
            >
              {src.charAt(0).toUpperCase() + src.slice(1)}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: '#2a2d3a', margin: '0 4px' }} />
          <button
            onClick={() => store.setCanvasUI({ dualMapEnabled: !store.canvasUI.dualMapEnabled })}
            style={{
              padding: '3px 8px', borderRadius: 4, border: '1px solid',
              fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
              background: store.canvasUI.dualMapEnabled ? '#7c3aed' : 'transparent',
              borderColor: store.canvasUI.dualMapEnabled ? '#6d28d9' : '#2a2d3a',
              color: store.canvasUI.dualMapEnabled ? 'white' : '#64748b',
            }}
          >
            ⊞ Dual Map
          </button>
          <button
            onClick={() => store.toggleIrradianceMap()}
            style={{
              padding: '3px 8px', borderRadius: 4, border: '1px solid',
              fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
              background: store.irradianceMap.enabled ? '#f59e0b' : 'transparent',
              borderColor: store.irradianceMap.enabled ? '#d97706' : '#2a2d3a',
              color: store.irradianceMap.enabled ? '#0f1117' : '#64748b',
            }}
          >
            ☀ Irradiance
          </button>
        </div>

        {/* Center: scale info */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748b' }}>
          <span>Scale: {(store.canvasScale * 100).toFixed(0)}%</span>
          <span>1px = {(1 / store.pxPerMeter).toFixed(3)}m</span>
          <span>Tool: {store.activeTool}</span>
          {store.selectedIds.length > 0 && (
            <span style={{ color: '#fbbf24' }}>{store.selectedIds.length} selected</span>
          )}
        </div>

        {/* Right: X/Y/Z coordinate display */}
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
          <span>X: <span style={{ color: '#94a3b8' }}>{store.canvasUI.cursorX.toFixed(2)}m</span></span>
          <span>Y: <span style={{ color: '#94a3b8' }}>{store.canvasUI.cursorY.toFixed(2)}m</span></span>
          <span>Z: <span style={{ color: '#94a3b8' }}>0.00m</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── Satellite Konva Layer — fetches image via backend proxy, draws inside Konva ──

const GMAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

// Google Static Maps: max 640x640 free, scale=2 gives 1280x1280 image
function SatelliteKonvaLayer({ lat, lng, pxPerMeter }: { lat: number; lng: number; pxPerMeter: number }) {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    setImg(undefined);
    // Build static maps URL — fetched directly, CORS allowed for img tags
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=19&size=640x640&scale=2&maptype=satellite&key=${GMAPS_KEY}`;

    const image = new window.Image();
    // No crossOrigin needed — we're not drawing to a tainted canvas via Konva
    image.onload = () => setImg(image);
    image.onerror = () => {
      // Fallback: try without scale
      const fallback = new window.Image();
      fallback.onload = () => setImg(fallback);
      fallback.src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=19&size=640x640&maptype=satellite&key=${GMAPS_KEY}`;
    };
    image.src = url;
  }, [lat, lng]);

  // Calculate accurate physical coverage based on zoom 19 and 640 map size.
  // The 'size=640x640' dictates the coverage. 'scale=2' just returns a higher-res image for the same area.
  const metersPerPixel = getMercatorMetersPerPixel(lat, 19);
  const physicalWidthM = 640 * metersPerPixel;
  
  // Size in canvas units
  const sizePx = physicalWidthM * pxPerMeter;

  return (
    <Layer listening={false}>
      <KonvaImage
        image={img}
        x={-sizePx / 2}
        y={-sizePx / 2}
        width={sizePx}
        height={sizePx}
        opacity={0.8}
      />
    </Layer>
  );
}
