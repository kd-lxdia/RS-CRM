import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera, Environment, ContactShadows, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { Button, Slider, Typography, Tag, Select, Tooltip, Space } from 'antd';
import { DesktopOutlined, CompressOutlined, EyeOutlined, EyeInvisibleOutlined, AppstoreOutlined, CompassOutlined, CaretDownOutlined } from '@ant-design/icons';
import type { RoofSection } from './RoofMapper';
import type { PanelLayoutResult, PanelPosition } from './PanelLayoutEngine';
import { calculateSunPosition, latlngToMeters } from './PanelLayoutEngine';

const { Text } = Typography;

function shadingColor(percent: number): THREE.Color {
  if (percent < 10) return new THREE.Color('#4ade80');
  if (percent < 25) return new THREE.Color('#fbbf24');
  return new THREE.Color('#ef4444');
}

// Global wrapper to map 2D (X, Y) to 3D horizontal (X, -Z)
function MapGroup({ children }: { children: React.ReactNode }) {
  // Rotate so that X-Y plane becomes X-Z plane. 
  // +X is East, +Y in 2D is North. With -PI/2 on X:
  // 3D +X = East
  // 3D -Z = North
  // 3D +Y = UP (Z in 2D).
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {children}
    </group>
  );
}

// ─── Roof Geometry ────────────────────────────────────────────────────────────

function RoofMesh({ section, globalCenter }: { section: RoofSection; globalCenter: { lat: number, lng: number } }) {
  const pts = latlngToMeters(section.polygon, globalCenter);
  if (pts.length < 3) return null;

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => s.lineTo(p.x, p.y));
    s.closePath();
    return s;
  }, [pts]);

  const roofGeo = useMemo(() => {
    return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  }, [shape]);

  const parapetGeo = useMemo(() => {
    return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  }, [shape]);

  // Compute tilt geometry. We rotate the roof plane to simulate tilt.
  // We want to tilt it such that it faces `azimuthDeg`.
  // Azimuth 180 (South) -> faces -Y in 2D. 
  // To face -Y, we lift the +Y edge. Tilted around X axis by -tiltDeg.
  // Wait, ThreeJS rotation order is XYZ. 
  const tiltRad = (section.tiltDeg * Math.PI) / 180;
  // If azimuth is 180, we want to pitch forward.
  // Azimuth 0 = North, 90 = East, 180 = South, 270 = West.
  // In our 2D plane: X is East, Y is North.
  // To tilt facing an arbitrary azimuth, we rotate around an axis perpendicular to azimuth.
  const aziRad = -(section.azimuthDeg * Math.PI) / 180;
  const rotMatrix = new THREE.Matrix4();
  // We rotate to align with azimuth, tilt, then rotate back
  rotMatrix.makeRotationZ(-aziRad);
  rotMatrix.multiply(new THREE.Matrix4().makeRotationX(tiltRad));
  rotMatrix.multiply(new THREE.Matrix4().makeRotationZ(aziRad));

  const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix);

  return (
    <group rotation={[euler.x, euler.y, euler.z]}>
      <mesh geometry={roofGeo} castShadow receiveShadow position={[0, 0, 0]}>
        <meshStandardMaterial color="#c2c7cd" roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Parapet Wall - slightly taller but inset? for now just a thick border */}
      <lineSegments geometry={new THREE.EdgesGeometry(roofGeo)}>
        <lineBasicMaterial color="#94a3b8" />
      </lineSegments>
    </group>
  );
}

// ─── House Body ───────────────────────────────────────────────────────────────

function HouseBody({ section, globalCenter }: { section: RoofSection; globalCenter: { lat: number, lng: number } }) {
  const pts = latlngToMeters(section.polygon, globalCenter);
  if (pts.length < 3) return null;

  // Calculate the tilted plane's normal to find exact z-height at any (x,y)
  const tiltRad = (section.tiltDeg * Math.PI) / 180;
  const aziRad = -(section.azimuthDeg * Math.PI) / 180;
  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeRotationZ(-aziRad);
  rotMatrix.multiply(new THREE.Matrix4().makeRotationX(tiltRad));
  rotMatrix.multiply(new THREE.Matrix4().makeRotationZ(aziRad));

  const normal = new THREE.Vector3(0, 0, 1).applyMatrix4(rotMatrix);
  
  // Plane equation: n.x*x + n.y*y + n.z*z = 0 (since it pivots around origin 0,0,0)
  const getZ = (x: number, y: number) => {
    return -(normal.x * x + normal.y * y) / normal.z;
  };

  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];

    const z1 = getZ(p1.x, p1.y);
    const z2 = getZ(p2.x, p2.y);

    const baseIdx = vertices.length / 3;

    // Wall quadrilateral vertices
    // V0: Top-Left (p1 at roof height)
    vertices.push(p1.x, p1.y, z1);
    // V1: Bottom-Left (p1 at ground)
    vertices.push(p1.x, p1.y, -10);
    // V2: Bottom-Right (p2 at ground)
    vertices.push(p2.x, p2.y, -10);
    // V3: Top-Right (p2 at roof height)
    vertices.push(p2.x, p2.y, z2);

    // Two triangles per wall
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
  }

  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [pts, tiltRad, aziRad]);

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#f0f2f5" roughness={0.9} metalness={0.0} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Solar Panel Mesh ─────────────────────────────────────────────────────────

function SolarPanel({ panel, pw, ph, showShading, tiltDeg, azimuthDeg, onClick }: {
  panel: PanelPosition;
  pw: number;
  ph: number;
  showShading: boolean;
  tiltDeg: number;
  azimuthDeg: number;
  onClick?: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const baseColor = useMemo(() => {
    if (showShading) return shadingColor(panel.shadingPercent);
    return new THREE.Color('#0f172a');
  }, [showShading, panel.shadingPercent]);

  // Height above the roof plane
  const mountHeight = 0.15; 
  
  // Calculate roof tilt rotation
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const aziRad = -(azimuthDeg * Math.PI) / 180;
  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeRotationZ(-aziRad);
  rotMatrix.multiply(new THREE.Matrix4().makeRotationX(tiltRad));
  rotMatrix.multiply(new THREE.Matrix4().makeRotationZ(aziRad));
  const planeEuler = new THREE.Euler().setFromRotationMatrix(rotMatrix);

  // In PanelLayoutEngine, orientation ('PORTRAIT'/'LANDSCAPE') swaps pw and ph.
  // The panels are ALWAYS laid out axis-aligned to the grid rotated by azimuth.
  // We need to rotate the individual panel around Z to face the azimuth correctly.
  
  return (
    <group rotation={[planeEuler.x, planeEuler.y, planeEuler.z]}>
      <group 
        position={[panel.x, panel.y, mountHeight]} 
        rotation={[0, 0, -aziRad]} // Rotate flat panel to align with azimuth layout grid
      >
        {/* Mounting Rails */}
        <mesh position={[0, -ph * 0.25, -0.05]} castShadow receiveShadow>
          <boxGeometry args={[pw * 0.9, 0.05, 0.1]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, ph * 0.25, -0.05]} castShadow receiveShadow>
          <boxGeometry args={[pw * 0.9, 0.05, 0.1]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Panel Frame */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[pw, ph, 0.04]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Solar Cells */}
        <mesh
          position={[0, 0, 0.021]} 
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
          onClick={(e) => { e.stopPropagation(); onClick?.(panel.id); }}
        >
          <boxGeometry args={[pw - 0.04, ph - 0.04, 0.002]} />
          <meshPhysicalMaterial
            color={baseColor}
            metalness={0.6}
            roughness={0.1}
            clearcoat={1.0}
            emissive={hovered ? new THREE.Color('#fbbf24') : new THREE.Color(0, 0, 0)}
            emissiveIntensity={hovered ? 0.2 : 0}
          />
        </mesh>

        {/* Grid lines */}
        <lineSegments position={[0, 0, 0.023]}>
          <edgesGeometry args={[new THREE.BoxGeometry(pw - 0.04, ph - 0.04, 0.001)]} />
          <lineBasicMaterial color={showShading ? '#ffffff' : '#334155'} transparent opacity={0.6} />
        </lineSegments>

        {hovered && (
          <Html distanceFactor={15} position={[0, 0, 0.5]}>
            <div className="bg-slate-900/95 text-white rounded-lg px-3 py-2 text-xs shadow-xl border border-slate-700/50 backdrop-blur-md">
              <div className="font-bold text-blue-400 mb-1">Panel #{panel.id + 1}</div>
              <div>String: {panel.stringId + 1}</div>
              <div>R{panel.row + 1}, C{panel.col + 1}</div>
              {showShading && (
                <div className={panel.shadingPercent > 25 ? 'text-red-400 font-bold' : panel.shadingPercent > 10 ? 'text-yellow-400' : 'text-green-400'}>
                  Shading: {panel.shadingPercent}%
                </div>
              )}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

// ─── Sun Sphere ───────────────────────────────────────────────────────────────

function SunLight({ hour, date }: { hour: number; date: Date }) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const [target] = useState(() => new THREE.Object3D());

  const sunPos = useMemo(() => {
    const pos = calculateSunPosition(date, hour);
    const el = (pos.elevationDeg * Math.PI) / 180;
    // Map bearing (North = 0) to 3D space: North is -Z, East is +X.
    const az = (pos.azimuthDeg * Math.PI) / 180;
    const r = 80;
    // In our scene, +Y is UP. 
    // +X is East, -Z is North.
    // Standard spherical coordinates for bearing:
    return new THREE.Vector3(
      r * Math.cos(el) * Math.sin(az), // X (East)
      r * Math.sin(el),                // Y (Up)
      -r * Math.cos(el) * Math.cos(az) // Z (-North)
    );
  }, [hour, date]);

  useFrame(({ scene }) => {
    if (lightRef.current) {
      if (!scene.children.includes(target)) scene.add(target);
      target.position.set(0, 0, 0);
      lightRef.current.position.copy(sunPos);
      lightRef.current.target = target;
      lightRef.current.target.updateMatrixWorld();
    }
  });

  const intensity = sunPos.y > 0 ? Math.min(sunPos.y / 10, 1) * 2.5 : 0;

  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={intensity}
        color="#fff5e6"
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0005}
      />
      {sunPos.y > 0 && (
        <mesh position={sunPos}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </>
  );
}

// ─── Ground Plane ─────────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
      <planeGeometry args={[300, 300]} />
      <meshStandardMaterial color="#9ca3af" roughness={1} metalness={0} />
    </mesh>
  );
}

// ─── Main 3D Viewer ───────────────────────────────────────────────────────────

export interface Solar3DViewerProps {
  roofSections: RoofSection[];
  panelLayout: PanelLayoutResult;
  panelWidthM?: number;
  panelHeightM?: number;
  sunDate?: Date;
  showShading?: boolean;
  onPanelClick?: (panelId: number) => void;
}

export default function Solar3DViewer({
  roofSections,
  panelLayout,
  panelWidthM = 1.134,
  panelHeightM = 2.278,
  sunDate,
  showShading = false,
  onPanelClick,
}: Solar3DViewerProps) {
  const [hour, setHour] = useState(12);
  const [activeDate, setActiveDate] = useState<Date>(sunDate || new Date());
  const [viewMode, setViewMode] = useState<'perspective' | 'top'>('perspective');
  const [showHouse, setShowHouse] = useState(true);

  const controlsRef = useRef<any>(null);

  const handleRecenter = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  const globalCenter = useMemo(() => {
    if (!roofSections || roofSections.length === 0) return { lat: 0, lng: 0 };
    const firstPoly = roofSections[0].polygon;
    if (!firstPoly || firstPoly.length === 0) return { lat: 0, lng: 0 };
    const lat = firstPoly.reduce((s, p) => s + p.lat, 0) / firstPoly.length;
    const lng = firstPoly.reduce((s, p) => s + p.lng, 0) / firstPoly.length;
    return { lat, lng };
  }, [roofSections]);

  const sunPos = useMemo(() => calculateSunPosition(activeDate, hour), [activeDate, hour]);
  const cameraPos: [number, number, number] = viewMode === 'top' ? [0, 40, 0.1] : [15, 25, 30];

  const setDatePreset = (preset: 'today' | 'winter' | 'summer') => {
    const year = new Date().getFullYear();
    if (preset === 'today') setActiveDate(new Date());
    else if (preset === 'winter') setActiveDate(new Date(year, 11, 21));
    else setActiveDate(new Date(year, 5, 21));
  };

  const systemKw = (panelLayout.count * panelWidthM * panelHeightM * 200) / 1000;
  const avgShading = panelLayout.panels.length > 0
    ? Math.round(panelLayout.panels.reduce((s, p) => s + (p.shadingPercent || 0), 0) / panelLayout.panels.length)
    : 0;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-transparent" style={{ height: '700px' }}>
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
        <div className="bg-apple-cardLight dark:bg-apple-cardDark/90 backdrop-blur-md rounded-lg shadow-sm px-4 py-2 flex gap-3 items-center">
          <Text className="text-xs font-semibold uppercase text-apple-textMuted">Date:</Text>
          <div className="flex gap-1">
            <Button size="small" type="text" onClick={() => setDatePreset('today')}>Today</Button>
            <Button size="small" type="text" className="text-blue-600" onClick={() => setDatePreset('winter')}>Winter ❄️</Button>
            <Button size="small" type="text" className="text-orange-600" onClick={() => setDatePreset('summer')}>Summer ☀️</Button>
          </div>
        </div>
        <div className="bg-apple-cardLight dark:bg-apple-cardDark/90 backdrop-blur-md rounded-lg shadow-sm px-4 py-2 flex gap-2">
          <Button size="small" icon={<DesktopOutlined />} onClick={() => setViewMode(v => v === 'top' ? 'perspective' : 'top')}>
            {viewMode === 'top' ? '3D View' : 'Top View'}
          </Button>
          <Button size="small" onClick={() => setShowHouse(h => !h)}>
            {showHouse ? 'Hide House' : 'Show House'}
          </Button>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 text-white rounded-xl p-4 text-sm shadow-2xl">
        <div className="font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2">System Details</div>
        <div className="flex justify-between w-40 mb-1"><span className="text-apple-gray">Panels</span><strong>{panelLayout.count}</strong></div>
        <div className="flex justify-between w-40 mb-1"><span className="text-apple-gray">Capacity</span><strong className="text-green-400">{systemKw.toFixed(1)} kW</strong></div>
        <div className="flex justify-between w-40 mb-1"><span className="text-apple-gray">Efficiency</span><strong className="text-indigo-400">{Math.round(panelLayout.layoutEfficiency * 100)}%</strong></div>
      </div>

      {/* Left Sidebar Tools */}
      <div className="absolute top-1/3 left-4 z-10 flex flex-col gap-3">
        <Button className="bg-[#3D4044] border-0 text-white font-medium hover:bg-[#4E5155] shadow-lg flex items-center justify-center h-10 w-44 rounded-md">
          WireSize Calculator
        </Button>
        <Button className="bg-[#3D4044] border-0 text-white font-medium hover:bg-[#4E5155] shadow-lg flex items-center justify-center h-10 w-44 rounded-md">
          Irradiance Map
        </Button>
        <Button className="bg-[#3D4044] border-0 text-white font-medium hover:bg-[#4E5155] shadow-lg flex items-center justify-center h-10 w-44 rounded-md">
          Solar Access
        </Button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[400px]">
        <div className="bg-apple-cardLight dark:bg-apple-cardDark/95 rounded-2xl shadow-xl p-4">
          <div className="flex justify-between text-xs text-apple-gray font-semibold mb-2">
            <span>6 AM</span><span className="text-apple-textLight dark:text-apple-textDark">{hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}</span><span>6 PM</span>
          </div>
          <Slider min={6} max={18} value={hour} onChange={setHour} step={0.5} />
        </div>
      </div>

      {/* Bottom Interface Controls */}
      <div className="absolute bottom-6 left-4 z-10 flex gap-2">
        <Button className="bg-white text-gray-800 font-semibold border border-gray-200 shadow hover:bg-gray-50 flex items-center justify-center h-10 rounded px-4">
          <Space>
            <AppstoreOutlined />
            Dual Map
          </Space>
        </Button>
        <Button className="bg-white text-gray-800 font-semibold border border-gray-200 shadow hover:bg-gray-50 flex items-center justify-center h-10 rounded px-4">
          <Space>
            <CompressOutlined />
            Resize
          </Space>
        </Button>
        <Button className="bg-white text-gray-800 font-semibold border border-gray-200 shadow hover:bg-gray-50 flex items-center justify-center h-10 rounded px-4">
          <Space>
            <EyeOutlined />
            Google
            <CaretDownOutlined className="text-[10px] ml-1" />
          </Space>
        </Button>
        <Button className="bg-white text-gray-800 font-semibold border border-gray-200 shadow hover:bg-gray-50 flex items-center justify-center h-10 rounded px-4">
          <Space>
            <EyeInvisibleOutlined />
            GoogleSolar3D
            <CaretDownOutlined className="text-[10px] ml-1" />
          </Space>
        </Button>
        <Button 
          type="primary"
          className="bg-blue-600 font-semibold shadow hover:bg-blue-500 flex items-center justify-center h-10 rounded px-4"
          onClick={handleRecenter}
        >
          <Space>
            <CompassOutlined />
            Recenter Map
          </Space>
        </Button>
      </div>

      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Environment preset="city" />
        <Sky sunPosition={[-1, 0, 1]} inclination={0.2} azimuth={0.25} rayleigh={1.5} turbidity={5} mieCoefficient={0.005} />
        <PerspectiveCamera makeDefault fov={45} position={cameraPos} />
        <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2 - 0.05} minDistance={20} maxDistance={150} />
        <ambientLight intensity={0.4} />
        <SunLight hour={hour} date={activeDate} />
        <Suspense fallback={null}>
          <MapGroup>
            {roofSections.map(section => (
              <RoofMesh key={section.id} section={section} globalCenter={globalCenter} />
            ))}
            {showHouse && roofSections.map(section => (
              <HouseBody key={`house-${section.id}`} section={section} globalCenter={globalCenter} />
            ))}
            {panelLayout.panels.map(panel => (
              <SolarPanel
                key={panel.id}
                panel={panel}
                pw={panelWidthM}
                ph={panelHeightM}
                showShading={showShading}
                tiltDeg={roofSections[0]?.tiltDeg || 0}
                azimuthDeg={roofSections[0]?.azimuthDeg || 0}
                onClick={onPanelClick}
              />
            ))}
          </MapGroup>
        </Suspense>
        <Ground />
        <gridHelper args={[100, 100, '#64748b', '#cbd5e1']} position={[0, -4.99, 0]} />
      </Canvas>
    </div>
  );
}

