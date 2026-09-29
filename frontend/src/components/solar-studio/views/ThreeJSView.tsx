// =============================================================================
// 3D View — Three.js Scene for the Design Studio
// =============================================================================

import { useMemo, useState, Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Environment, Text as DreiText, Line as DreiLine } from '@react-three/drei';
import * as THREE from 'three';
import earcut from 'earcut';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { useDesignStore, MODULE_DATABASE } from '../store/designStore';

// Apply BVH globally to Three.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree as any;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree as any;
THREE.Mesh.prototype.raycast = acceleratedRaycast as any;
import { irradianceAccessColor, solarAccessColor } from '../engine/SolarAccessEngine';
import { generateStructure, resolveMountingConfig } from '../engine/MountingStructureEngine';
import type { StructuralMember, StructuralMaterial, StructuralAssembly, DesignSubArray } from '../store/types';

export default function ThreeJSView() {
  const store = useDesignStore();
  const [hour, setHour] = useState(12);
  const controlsRef = useRef<any>(null);

  const handleRecenter = () => {
    if (controlsRef.current) {
      // Reset camera position and controls
      controlsRef.current.reset();
    }
  };

  // Calculate irradiance based on time of day (simplified)
  const getIrradianceColor = (baseColor: string, hour: number) => {
    if (!store.irradianceMap.enabled && !store.showIrradianceMap) return baseColor;
    
    // Peak irradiance at noon, lower at morning/evening
    const peakHour = 12;
    const hourDiff = Math.abs(hour - peakHour);
    const irradianceFactor = Math.max(0, 1 - (hourDiff / 6)); // 0 to 1
    
    // Color gradient from blue (low) to yellow (medium) to red (high)
    if (irradianceFactor > 0.7) return '#ef4444'; // High - red
    if (irradianceFactor > 0.4) return '#f59e0b'; // Medium - orange
    return '#3b82f6'; // Low - blue
  };

  return (
    <div className="studio-canvas-area" style={{ position: 'relative' }}>
      {/* Time slider */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1d27ee', borderRadius: 12, padding: '8px 20px', zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 12,
        border: '1px solid #2a2d3a', color: '#94a3b8', fontSize: 12,
      }}>
        <span>6 AM</span>
        <input type="range" min={6} max={18} step={0.5} value={hour}
          onChange={e => setHour(Number(e.target.value))}
          style={{ width: 200, accentColor: '#f59e0b' }} />
        <span>6 PM</span>
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
          {hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
        </span>
      </div>

      {/* Recenter button */}
      <button
        onClick={handleRecenter}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          background: '#1a1d27ee',
          border: '1px solid #2a2d3a',
          borderRadius: 8,
          padding: '10px 20px',
          color: '#94a3b8',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2a2d3aee';
          e.currentTarget.style.color = '#f59e0b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#1a1d27ee';
          e.currentTarget.style.color = '#94a3b8';
        }}
        title="Reset camera to default position"
      >
        <span style={{ fontSize: 16 }}>⟲</span>
        Recenter
      </button>

      {/* Irradiance Map Legend */}
      {(store.irradianceMap.enabled || store.showIrradianceMap) && (
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: '#1a1d27ee',
          border: '1px solid #2a2d3a',
          borderRadius: 8,
          padding: '12px 16px',
          zIndex: 20,
          color: '#94a3b8',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#f59e0b' }}>
            ☀ Irradiance Map
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, background: '#ef4444', borderRadius: 3 }} />
              <span>High (700-1000 W/m²)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, background: '#f59e0b', borderRadius: 3 }} />
              <span>Medium (400-700 W/m²)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, background: '#3b82f6', borderRadius: 3 }} />
              <span>Low (0-400 W/m²)</span>
            </div>
          </div>
        </div>
      )}

      <Canvas shadows dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Sky sunPosition={[-1, 0, 1]} inclination={0.2} azimuth={0.25} />
          <PerspectiveCamera makeDefault fov={45} position={[20, 25, 30]} />
          <OrbitControls 
            ref={controlsRef}
            enablePan 
            enableZoom 
            enableRotate
            enableDamping
            dampingFactor={0.1}
            panSpeed={2.0}
            rotateSpeed={1.0}
            zoomSpeed={1.5}
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minDistance={3} 
            maxDistance={300}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN
            }}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN
            }}
          />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[30, 40, 20]}
            castShadow
            intensity={2}
            shadow-mapSize={[2048, 2048]}
          />

          {/* Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#6b7280" roughness={1} />
          </mesh>
          <gridHelper args={[200, 200, '#4b5563', '#9ca3af']} position={[0, -0.09, 0]} />

          {/* Roofs */}
          {store.roofs.map(roof => <Roof3D key={roof.id} roof={roof} pxPerMeter={store.pxPerMeter} hour={hour} getIrradianceColor={getIrradianceColor} />)}

          {/* Modules */}
          {store.subArrays.map(sa => <StructureSystem3D key={sa.id} sa={sa} store={store} hour={hour} getIrradianceColor={getIrradianceColor} />)}

          {/* Obstructions */}
          {store.obstructions.map(obs => <Obstruction3D key={obs.id} obs={obs} pxPerMeter={store.pxPerMeter} store={store} />)}

          {/* Inverters */}
          {store.inverters.map(inv => (
            <mesh key={inv.id} position={[inv.x / store.pxPerMeter, 1, inv.y / store.pxPerMeter]}>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshStandardMaterial color="#7c3aed" />
            </mesh>
          ))}

          {/* Strings */}
          {store.layers.stringing && store.inverters.map(inv =>
            inv.strings.map((str, si) => {
              const points: THREE.Vector3[] = [];
              for (const modId of str.moduleIds) {
                for (const sa of store.subArrays) {
                  const mod = sa.modules.find(m => m.id === modId);
                  if (mod) {
                    points.push(new THREE.Vector3(mod.x / store.pxPerMeter, 0.3, mod.y / store.pxPerMeter));
                  }
                }
              }
              if (points.length < 2) return null;
              return (
                <DreiLine
                  key={`${inv.id}-s${si}`}
                  points={points}
                  color="#22c55e"
                  lineWidth={2}
                />
              );
            })
          )}

          {/* Text blocks as billboards */}
          {store.textBlocks.map(tb => (
            <DreiText
              key={tb.id}
              position={[tb.x / store.pxPerMeter, 2, tb.y / store.pxPerMeter]}
              fontSize={0.3}
              color={tb.color}
              anchorX="center"
              anchorY="middle"
            >
              {tb.text}
            </DreiText>
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Roof3D({ roof, pxPerMeter, hour, getIrradianceColor }: { roof: any; pxPerMeter: number; hour: number; getIrradianceColor: (color: string, hour: number) => string }) {
  const { shape, center } = useMemo(() => {
    if (!roof.vertices || roof.vertices.length < 3) return { shape: null, center: { x: 0, y: 0 } };
    
    // Convert vertices to meters
    const pts = roof.vertices.map((v: any) => ({ x: v.x / pxPerMeter, y: v.y / pxPerMeter }));
    
    // Calculate centroid
    const centerX = pts.reduce((sum: number, p: any) => sum + p.x, 0) / pts.length;
    const centerY = pts.reduce((sum: number, p: any) => sum + p.y, 0) / pts.length;
    
    // Create shape relative to centroid (so shape is centered at origin)
    const s = new THREE.Shape();
    s.moveTo(pts[0].x - centerX, pts[0].y - centerY);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i].x - centerX, pts[i].y - centerY);
    }
    s.closePath();
    
    return { shape: s, center: { x: centerX, y: centerY } };
  }, [roof.vertices, pxPerMeter]);

  if (!shape) return null;

  const store = useDesignStore();
  const isSelected = store.selectedIds.includes(roof.id);
  
  // Use the roof's color from the store, with irradiance overlay
  const baseRoofColor = roof.color || '#3b82f6';
  const roofColor = getIrradianceColor(baseRoofColor, hour);
  const buildingHeight = roof.height || 3; // Building wall height in meters
  const roofThickness = 0.2; // Roof slab thickness
  const baseHeight = roof.baseHeight || 0;

  // Create custom extruded geometry using earcut
  const createExtrusion = (depth: number) => {
    if (!roof.vertices || roof.vertices.length < 3) return new THREE.BufferGeometry();
    const pts = roof.vertices.map((v: any) => ({ x: v.x / pxPerMeter, y: v.y / pxPerMeter }));
    const centerX = pts.reduce((sum: number, p: any) => sum + p.x, 0) / pts.length;
    const centerY = pts.reduce((sum: number, p: any) => sum + p.y, 0) / pts.length;
    const localPts = pts.map((p: any) => ({ x: p.x - centerX, y: p.y - centerY }));
    
    const data: number[] = [];
    localPts.forEach((p: any) => { data.push(p.x, p.y); });
    
    const triangles = earcut(data);
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Base vertices (Y=0)
    for(let i=0; i<localPts.length; i++) vertices.push(localPts[i].x, 0, localPts[i].y);
    // Top vertices (Y=depth)
    for(let i=0; i<localPts.length; i++) vertices.push(localPts[i].x, depth, localPts[i].y);
    
    const topOffset = localPts.length;
    
    // Top face (reverse earcut winding to face +Y)
    for(let i=0; i<triangles.length; i+=3) {
      indices.push(triangles[i+2] + topOffset, triangles[i+1] + topOffset, triangles[i] + topOffset);
    }
    // Bottom face (faces -Y)
    for(let i=0; i<triangles.length; i+=3) {
      indices.push(triangles[i], triangles[i+1], triangles[i+2]);
    }
    // Walls
    for(let i=0; i<localPts.length; i++) {
      const next = (i + 1) % localPts.length;
      indices.push(i, i + topOffset, next);
      indices.push(next, i + topOffset, next + topOffset);
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  // Create building walls (extruded from ground to roof level)
  const wallGeo = useMemo(() => createExtrusion(buildingHeight), [roof.vertices, pxPerMeter, buildingHeight]);

  // Create roof slab (using earcut for stable triangulation)
  const roofGeo = useMemo(() => createExtrusion(roofThickness), [roof.vertices, pxPerMeter, roofThickness]);

  return (
    <group position={[center.x, 0, center.y]}>
      {/* Building walls */}
      <group position={[0, baseHeight, 0]}>
        <mesh 
          geometry={wallGeo} 
          castShadow 
          receiveShadow
          onClick={(e) => { 
            e.stopPropagation(); 
            store.selectObjects([roof.id], 'roof'); 
          }}
        >
          <meshStandardMaterial 
            color="#e5e7eb"
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
        
        {/* Wall edges */}
        <lineSegments geometry={new THREE.EdgesGeometry(wallGeo)}>
          <lineBasicMaterial color="#9ca3af" />
        </lineSegments>
      </group>

      {/* Roof surface - positioned on top of walls */}
      <group position={[0, baseHeight + buildingHeight, 0]}>
        <mesh 
          geometry={roofGeo} 
          castShadow 
          receiveShadow
          onClick={(e) => { 
            e.stopPropagation(); 
            store.selectObjects([roof.id], 'roof'); 
          }}
        >
          <meshStandardMaterial 
            color={isSelected ? '#fbbf24' : roofColor} 
            roughness={0.6}
            metalness={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Roof edge lines */}
        <lineSegments geometry={new THREE.EdgesGeometry(roofGeo)}>
          <lineBasicMaterial color={isSelected ? '#fbbf24' : '#1e293b'} />
        </lineSegments>
      </group>

      {/* Parapet walls (if any) */}
      {(roof.parapetHeight || 0) > 0 && (
        <group position={[0, baseHeight + buildingHeight + roofThickness, 0]}>
          {roof.vertices.map((v1: any, i: number) => {
            const v2 = roof.vertices[(i + 1) % roof.vertices.length];
            const p1 = new THREE.Vector3(v1.x / pxPerMeter - center.x, 0, v1.y / pxPerMeter - center.y);
            const p2 = new THREE.Vector3(v2.x / pxPerMeter - center.x, 0, v2.y / pxPerMeter - center.y);
            
            const dir = p2.clone().sub(p1);
            const len = dir.length();
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
            const euler = new THREE.Euler().setFromQuaternion(quaternion);

            // 0.2m parapet thickness. length + thickness helps close corner gaps
            const parapetHeight = roof.parapetHeight;
            const parapetThickness = 0.2; 

            return (
              <mesh key={`parapet-${i}`} position={[mid.x, parapetHeight / 2, mid.z]} rotation={euler} castShadow receiveShadow>
                <boxGeometry args={[len + parapetThickness, parapetHeight, parapetThickness]} />
                <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

function StructureSystem3D({ sa, store, hour, getIrradianceColor }: { sa: DesignSubArray; store: any; hour: number; getIrradianceColor: (color: string, hour: number) => string }) {
  const spec = MODULE_DATABASE.find((m: any) => m.id === sa.moduleSpecId);
  if (!spec) return null;

  let pw = spec.widthMm / 1000;
  let ph = spec.lengthMm / 1000;
  if (sa.orientation === 'landscape') [pw, ph] = [ph, pw];

  // Find the roof this subarray belongs to
  const roof = store.roofs.find((r: any) => r.id === sa.roofId);
  if (!roof) return null;
  
  const roofHeight = (roof.baseHeight || 0) + (roof.height || 3) + 0.2;
  const mountingConfig = resolveMountingConfig(sa);

  // Convert tilt and azimuth to radians
  const tiltRad = (mountingConfig.tilt || 0) * Math.PI / 180;
  const azimuthRad = (mountingConfig.azimuth || 180) * Math.PI / 180;
  const panelTiltRad = mountingConfig.structureType === 'sat_single_axis' || mountingConfig.structureType === 'east_west' ? 0 : tiltRad;

  const panelGeo = useMemo(() => {
    const panel = new THREE.BoxGeometry(pw, 0.04, ph);
    panel.rotateX(-panelTiltRad);
    return panel;
  }, [pw, ph, panelTiltRad]);

  const assembly: StructuralAssembly = useMemo(() => generateStructure({
    subArray: sa,
    moduleSpec: spec,
    pxPerMeter: store.pxPerMeter,
    baseElevationM: roofHeight,
  }), [sa, spec, store.pxPerMeter, roofHeight]);

  const panelRef = useRef<THREE.InstancedMesh>(null);
  const panelSeats = useMemo(() => buildPanelSeatMap(sa, store.pxPerMeter, ph, roofHeight, mountingConfig.groundClearanceM, tiltRad, mountingConfig.railSectionH / 1000, mountingConfig.structureType), [sa, store.pxPerMeter, ph, roofHeight, mountingConfig.groundClearanceM, mountingConfig.railSectionH, mountingConfig.structureType, tiltRad]);
  const eastWestTilts = useMemo(() => buildEastWestPanelTiltMap(sa, store.pxPerMeter, tiltRad), [sa, store.pxPerMeter, tiltRad]);

  // Update instance matrices and colors
  useEffect(() => {
    if (!panelRef.current || !sa.modules) return;
    
    const dummy = new THREE.Object3D();
    const colorObj = new THREE.Color();
    
    sa.modules.forEach((mod: any, i: number) => {
      const seatY = panelSeats.get(mod.id) ?? roofHeight + mountingConfig.groundClearanceM + 0.08;
      dummy.position.set(mod.x / store.pxPerMeter, seatY, mod.y / store.pxPerMeter);
      dummy.rotation.set(eastWestTilts.get(mod.id) ?? 0, azimuthRad - Math.PI, 0);
      dummy.updateMatrix();
      
      panelRef.current!.setMatrixAt(i, dummy.matrix);
      
      // Determine color
      const saPct = store.solarAccess[mod.id];
      let colorStr = '#2563eb';
      if (store.irradianceMap.enabled && saPct !== undefined) {
        colorStr = irradianceAccessColor(saPct);
      } else if (store.solarAccessRun && saPct !== undefined) {
        colorStr = solarAccessColor(saPct);
      } else if (store.irradianceMap.enabled || store.showIrradianceMap) {
        colorStr = getIrradianceColor('#2563eb', hour);
      }
      
      colorObj.set(colorStr);
      panelRef.current!.setColorAt(i, colorObj);
    });
    
    panelRef.current.instanceMatrix.needsUpdate = true;
    if (panelRef.current.instanceColor) panelRef.current.instanceColor.needsUpdate = true;
  }, [sa.modules, roofHeight, azimuthRad, store.pxPerMeter, store.solarAccess, store.solarAccessRun, store.showIrradianceMap, store.irradianceMap.enabled, getIrradianceColor, hour, panelSeats, eastWestTilts, mountingConfig.groundClearanceM]);

  return (
    <group>
      <instancedMesh ref={panelRef} args={[panelGeo, undefined, sa.modules.length]} castShadow receiveShadow>
        <meshPhysicalMaterial 
          metalness={0.7} 
          roughness={0.15} 
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </instancedMesh>
      <StructureMemberInstances assembly={assembly} structureType={mountingConfig.structureType} />
      {assembly.foundations.map((foundation, index) => (
        <Foundation3D key={`${sa.id}-foundation-${index}`} foundation={foundation} />
      ))}
    </group>
  );
}

function StructureMemberInstances({ assembly, structureType }: { assembly: StructuralAssembly; structureType?: string }) {
  const staticMembers = assembly.members.filter(m => !(structureType === 'sat_single_axis' && ['torque_tube', 'bearing', 'drive_unit'].includes(m.type)));
  const trackerMembers = assembly.members.filter(m => structureType === 'sat_single_axis' && ['torque_tube', 'bearing', 'drive_unit'].includes(m.type));

  return (
    <>
      <MemberBatch members={staticMembers} />
      {trackerMembers.length > 0 && (
        <TrackerRotatingGroup members={trackerMembers} />
      )}
    </>
  );
}

function buildPanelSeatMap(
  subArray: DesignSubArray,
  pxPerMeter: number,
  moduleHeightM: number,
  roofHeight: number,
  groundClearanceM: number,
  tiltRad: number,
  railHeightM: number,
  structureType: string,
): Map<string, number> {
  const seats = new Map<string, number>();
  const grouped = new Map<string, DesignSubArray['modules']>();

  for (const module of subArray.modules) {
    const tableR = Math.floor(module.row / Math.max(subArray.tableRows, 1));
    const tableC = Math.floor(module.col / Math.max(subArray.tableCols, 1));
    const key = `${tableR}:${tableC}`;
    grouped.set(key, [...(grouped.get(key) || []), module]);
  }

  for (const modules of grouped.values()) {
    const zs = modules.map(module => module.y / pxPerMeter);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const centerZ = (minZ + maxZ) / 2;
    const tableHeight = Math.max(moduleHeightM, maxZ - minZ + moduleHeightM);
    const railTopOffset = railHeightM / 2 + 0.035;
    const trackerSeatY = roofHeight + groundClearanceM + 0.35 + railHeightM * 1.25 + 0.035;
    const eastWestRidgeY = roofHeight + groundClearanceM + 0.35;

    for (const module of modules) {
      if (structureType === 'sat_single_axis') {
        seats.set(module.id, trackerSeatY);
        continue;
      }

      if (structureType === 'ballasted_roof') {
        seats.set(module.id, roofHeight + groundClearanceM + railTopOffset);
        continue;
      }

      if (structureType === 'east_west') {
        const localZ = module.y / pxPerMeter - centerZ;
        seats.set(module.id, eastWestRidgeY - Math.abs(localZ) * Math.sin(tiltRad) + railTopOffset);
        continue;
      }

      const localZ = module.y / pxPerMeter - centerZ;
      const supportPlaneY = roofHeight + groundClearanceM + (localZ + tableHeight / 2) * Math.sin(tiltRad);
      seats.set(module.id, supportPlaneY + railTopOffset);
    }
  }

  return seats;
}

function buildEastWestPanelTiltMap(subArray: DesignSubArray, pxPerMeter: number, tiltRad: number): Map<string, number> {
  const tilts = new Map<string, number>();
  if (resolveMountingConfig(subArray).structureType !== 'east_west') return tilts;

  const grouped = new Map<string, DesignSubArray['modules']>();
  for (const module of subArray.modules) {
    const tableR = Math.floor(module.row / Math.max(subArray.tableRows, 1));
    const tableC = Math.floor(module.col / Math.max(subArray.tableCols, 1));
    const key = `${tableR}:${tableC}`;
    grouped.set(key, [...(grouped.get(key) || []), module]);
  }

  for (const modules of grouped.values()) {
    const zs = modules.map(module => module.y / pxPerMeter);
    const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (const module of modules) {
      const localZ = module.y / pxPerMeter - centerZ;
      tilts.set(module.id, localZ < 0 ? -tiltRad : tiltRad);
    }
  }

  return tilts;
}

function TrackerRotatingGroup({ members }: { members: StructuralMember[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const hour = useDesignStore(s => s.sunSimulation.hour);

  useFrame(() => {
    if (!groupRef.current) return;
    const rotationDeg = THREE.MathUtils.clamp((hour - 12) * 7.5, -45, 45);
    groupRef.current.rotation.x = THREE.MathUtils.degToRad(rotationDeg);
  });

  const center = useMemo(() => {
    const tube = members.find(m => m.type === 'torque_tube') || members[0];
    return tube
      ? new THREE.Vector3((tube.start[0] + tube.end[0]) / 2, (tube.start[1] + tube.end[1]) / 2, (tube.start[2] + tube.end[2]) / 2)
      : new THREE.Vector3();
  }, [members]);

  const localMembers = useMemo(() => members.map(m => ({
    ...m,
    start: [m.start[0] - center.x, m.start[1] - center.y, m.start[2] - center.z] as [number, number, number],
    end: [m.end[0] - center.x, m.end[1] - center.y, m.end[2] - center.z] as [number, number, number],
  })), [members, center]);

  return (
    <group ref={groupRef} position={center}>
      <MemberBatch members={localMembers} />
    </group>
  );
}

function MemberBatch({ members }: { members: StructuralMember[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, StructuralMember[]>();
    for (const member of members) {
      const key = `${member.type}:${member.material}:${memberProfile(member.type)}`;
      map.set(key, [...(map.get(key) || []), member]);
    }
    return Array.from(map.entries());
  }, [members]);

  return (
    <>
      {grouped.map(([key, batch]) => (
        <InstancedMemberGroup key={key} members={batch} material={batch[0].material} type={batch[0].type} />
      ))}
    </>
  );
}

function InstancedMemberGroup({ members, material, type }: { members: StructuralMember[]; material: StructuralMaterial; type: StructuralMember['type'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const profile = memberProfile(type);

  useEffect(() => {
    if (!ref.current) return;
    members.forEach((member, index) => {
      const start = new THREE.Vector3(...member.start);
      const end = new THREE.Vector3(...member.end);
      const dir = end.clone().sub(start);
      const length = Math.max(dir.length(), 0.03);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      dummy.position.copy(mid);
      const normalized = dir.normalize();
      if (profile === 'round') {
        const diameter = Math.max(member.sectionW, member.sectionH);
        dummy.quaternion.setFromUnitVectors(yAxis, normalized);
        dummy.scale.set(diameter, length, diameter);
      } else {
        dummy.quaternion.setFromUnitVectors(xAxis, normalized);
        dummy.scale.set(length, member.sectionH, member.sectionW);
      }
      dummy.updateMatrix();
      ref.current!.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [members, dummy, xAxis, yAxis, profile]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, members.length]} castShadow receiveShadow>
      {profile === 'round'
        ? <cylinderGeometry args={[0.5, 0.5, 1, type === 'torque_tube' ? 32 : 18]} />
        : <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial {...materialProps(material)} />
    </instancedMesh>
  );
}

function Foundation3D({ foundation }: { foundation: StructuralAssembly['foundations'][number] }) {
  const baseY = foundation.elevationM ?? 0;
  const y = baseY - Math.max(foundation.depthM, 0.05) / 2;
  if (foundation.type === 'ballast') {
    return (
      <group position={[foundation.positionX, baseY, foundation.positionZ]}>
        <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
          <boxGeometry args={[foundation.widthM * 1.05, 0.18, foundation.widthM * 0.5]} />
          <meshStandardMaterial color="#a3a3a3" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.195, 0]} castShadow receiveShadow>
          <boxGeometry args={[foundation.widthM * 0.65, 0.03, foundation.widthM * 0.32]} />
          <meshStandardMaterial color="#71717a" metalness={0.35} roughness={0.45} />
        </mesh>
      </group>
    );
  }

  if (foundation.type === 'l_foot' || foundation.type === 'roof_hook') {
    return (
      <group position={[foundation.positionX, baseY, foundation.positionZ]}>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[foundation.widthM, 0.05, foundation.widthM * 0.58]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.11, -foundation.widthM * 0.18]} castShadow receiveShadow>
          <boxGeometry args={[foundation.widthM * 0.24, 0.18, 0.035]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.75} roughness={0.2} />
        </mesh>
        <mesh position={[foundation.widthM * 0.28, 0.058, foundation.widthM * 0.18]} castShadow receiveShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-foundation.widthM * 0.28, 0.058, foundation.widthM * 0.18]} castShadow receiveShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[foundation.positionX, 0, foundation.positionZ]}>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[foundation.widthM / 2, foundation.widthM / 2, Math.max(foundation.depthM, 0.35), 24]} />
        <meshStandardMaterial color={foundation.type === 'rcc_footing' ? '#8b8f98' : '#475569'} metalness={foundation.type === 'rcc_footing' ? 0 : 0.55} roughness={0.72} />
      </mesh>
      {foundation.type === 'screw_pile' && [0.35, 0.6, 0.85].map(offset => (
        <mesh key={offset} position={[0, baseY - offset, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[foundation.widthM * 0.32, 0.012, 8, 28]} />
          <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, baseY + 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[foundation.widthM * 1.15, 0.05, foundation.widthM * 1.15]} />
        <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.32} />
      </mesh>
    </group>
  );
}

type MemberProfile = 'round' | 'rect';

function memberProfile(type: StructuralMember['type']): MemberProfile {
  if (['column', 'brace', 'torque_tube', 'bearing'].includes(type)) return 'round';
  return 'rect';
}

function materialProps(material: StructuralMaterial): THREE.MeshStandardMaterialParameters {
  switch (material) {
    case 'aluminum':
      return { color: '#d7dee4', metalness: 0.88, roughness: 0.18, envMapIntensity: 0.7 };
    case 'steel_galv':
      return { color: '#52616f', metalness: 0.82, roughness: 0.28, envMapIntensity: 0.55 };
    case 'stainless':
      return { color: '#f1f5f9', metalness: 0.94, roughness: 0.16, envMapIntensity: 0.8 };
    case 'concrete':
      return { color: '#a3a3a3', metalness: 0, roughness: 0.96 };
    default:
      return { color: '#64748b', metalness: 0.6, roughness: 0.35 };
  }
}

function Obstruction3D({ obs, pxPerMeter, store }: { obs: any; pxPerMeter: number; store: any }) {
  // Find the roof this obstruction belongs to
  const roof = store.roofs.find((r: any) => r.id === obs.roofId);
  const roofHeight = roof ? (roof.baseHeight || 0) + (roof.height || 3) : 0;

  if (obs.type === 'cylinder' && obs.center) {
    return (
      <mesh position={[obs.center.x / pxPerMeter, roofHeight + obs.height / 2, obs.center.y / pxPerMeter]} castShadow>
        <cylinderGeometry args={[(obs.radius || 15) / pxPerMeter, (obs.radius || 15) / pxPerMeter, obs.height, 16]} />
        <meshStandardMaterial color="#ef4444" opacity={0.6} transparent />
      </mesh>
    );
  }

  if (obs.type === 'tree' && obs.center) {
    const tH = obs.trunkHeight || 3;
    const cH = obs.crownHeight || 4;
    const cR = obs.crownRadius || 2.5;
    const type = obs.treeModel || 'oak';
    
    const crownColor = type === 'pine' || type === 'conifer' ? '#2d5a27' : '#3a5f0b';

    return (
      <group position={[obs.center.x / pxPerMeter, roofHeight, obs.center.y / pxPerMeter]}>
        {/* Trunk */}
        <mesh position={[0, tH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[cR * 0.1, cR * 0.15, tH, 8]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        
        {/* Crown (Simplified declarative version for stability) */}
        {(type === 'pine' || type === 'conifer') ? (
          <group>
            {[0, 1, 2].map(i => (
              <mesh key={i} position={[0, tH + i * (cH * 0.25) + (cH * 0.5) / 2, 0]} castShadow receiveShadow>
                <coneGeometry args={[cR * (1 - i * 0.25), cH * 0.5, 16]} />
                <meshStandardMaterial color={crownColor} roughness={0.8} transparent opacity={0.95} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh position={[0, tH + cH / 2, 0]} scale={[cR, cH / 2, cR]} castShadow receiveShadow>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color={crownColor} roughness={0.8} transparent opacity={0.95} />
          </mesh>
        )}
      </group>
    );
  }

  if (obs.type === 'handrail' && obs.vertices.length >= 2) {
    const height = obs.height || 1.1; // 1.1m is standard handrail height
    const railColor = "#eab308"; // Safety Yellow
    const baseColor = "#64748b"; // Industrial Grey
    const postSpacing = 1.5; // meters between posts

    const roofTop = roofHeight + 0.2; // 0.2 is the roof slab thickness, bases must sit on top
    const posts: THREE.Vector3[] = [];
    const segments: { start: THREE.Vector3; end: THREE.Vector3; length: number }[] = [];

    // For each segment in the polyline
    for (let i = 0; i < obs.vertices.length - 1; i++) {
      const v1 = new THREE.Vector3(obs.vertices[i].x / pxPerMeter, roofTop, obs.vertices[i].y / pxPerMeter);
      const v2 = new THREE.Vector3(obs.vertices[i+1].x / pxPerMeter, roofTop, obs.vertices[i+1].y / pxPerMeter);
      
      const dir = v2.clone().sub(v1);
      const len = dir.length();
      const norm = dir.clone().normalize();
      
      segments.push({ start: v1, end: v2, length: len });
      
      // Always put a post at the start vertex
      posts.push(v1.clone());
      
      // Distribute posts evenly along the segment
      const numPosts = Math.floor(len / postSpacing);
      if (numPosts > 0) {
        const actualSpacing = len / (numPosts + 1);
        for (let j = 1; j <= numPosts; j++) {
          posts.push(v1.clone().add(norm.clone().multiplyScalar(j * actualSpacing)));
        }
      }
      
      // The end vertex will be handled by the next segment's start vertex,
      // EXCEPT for the last segment where we must explicitly add the final post
      if (i === obs.vertices.length - 2) {
        posts.push(v2.clone());
      }
    }

    return (
      <group>
        {/* Draw straight rail segments instead of a continuous spline to prevent overshoot artifacts */}
        {segments.map((seg, idx) => {
          const mid = seg.start.clone().add(seg.end).multiplyScalar(0.5);
          const topMid = new THREE.Vector3(mid.x, mid.y + height, mid.z);
          const midMid = new THREE.Vector3(mid.x, mid.y + height / 2, mid.z);
          
          // Rotation to align cylinder with the segment
          const dir = seg.end.clone().sub(seg.start).normalize();
          const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const euler = new THREE.Euler().setFromQuaternion(quaternion);

          return (
            <group key={`seg-${idx}`}>
              {/* Top Rail Segment */}
              <mesh position={[topMid.x, topMid.y, topMid.z]} rotation={euler} castShadow>
                <cylinderGeometry args={[0.025, 0.025, seg.length, 8]} />
                <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
              </mesh>
              {/* Mid Rail Segment */}
              <mesh position={[midMid.x, midMid.y, midMid.z]} rotation={euler} castShadow>
                <cylinderGeometry args={[0.02, 0.02, seg.length, 8]} />
                <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
              </mesh>
              
              {/* Corner joints (spheres) to make corners look smooth and connected */}
              <mesh position={[seg.start.x, seg.start.y + height, seg.start.z]} castShadow>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh position={[seg.start.x, seg.start.y + height / 2, seg.start.z]} castShadow>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
              </mesh>
              
              {/* End joint for the very last segment */}
              {idx === segments.length - 1 && (
                <>
                  <mesh position={[seg.end.x, seg.end.y + height, seg.end.z]} castShadow>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
                  </mesh>
                  <mesh position={[seg.end.x, seg.end.y + height / 2, seg.end.z]} castShadow>
                    <sphereGeometry args={[0.02, 8, 8]} />
                    <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
                  </mesh>
                </>
              )}
            </group>
          );
        })}

        {/* Posts and Bases */}
        {posts.map((pos, idx) => (
          <group key={`post-${idx}`} position={[pos.x, pos.y, pos.z]}>
            {/* Post pole (yellow) */}
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, height, 8]} />
              <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.5} />
            </mesh>
            {/* Post Base Collar (grey) */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <cylinderGeometry args={[0.028, 0.03, 0.16, 8]} />
              <meshStandardMaterial color={baseColor} metalness={0.6} roughness={0.6} />
            </mesh>
            {/* Flat Base Plate (grey) */}
            <mesh position={[0, 0.01, 0]} castShadow>
              <boxGeometry args={[0.25, 0.02, 0.25]} />
              <meshStandardMaterial color={baseColor} metalness={0.6} roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // Polygon/rectangle obstruction
  if (obs.vertices.length >= 3) {
    const shape = new THREE.Shape();
    const pts = obs.vertices.map((v: any) => ({ x: v.x / pxPerMeter, y: v.y / pxPerMeter }));
    shape.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p: any) => shape.lineTo(p.x, p.y));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: obs.height || 0.6, bevelEnabled: false });

    return (
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, roofHeight, 0]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color="#ef4444" opacity={0.5} transparent />
        </mesh>
      </group>
    );
  }

  return null;
}
