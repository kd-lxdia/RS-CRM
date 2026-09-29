import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { Button, Input, InputNumber, Select, Slider, Typography, Card, Divider, Tag, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, ExclamationCircleOutlined, AimOutlined } from '@ant-design/icons';
import { latlngToMeters, shoelaceAreaM2 } from './PanelLayoutEngine';

const { Text, Title } = Typography;
const SQ_FT_PER_SQ_M = 10.7639;

export interface LatLng { lat: number; lng: number; }

export interface RoofSection {
  id: string;
  name: string;
  polygon: LatLng[];
  tiltDeg: number;
  azimuthDeg: number;
  areaSqFt: number;
  usableAreaSqFt: number;
  color: string;
  obstructions: LatLng[][];
}

interface RoofMapperProps {
  address?: string;
  lat?: number;
  lng?: number;
  onChange: (sections: RoofSection[]) => void;
}

const SECTION_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

// Component that lives inside MapContainer to access map instance
function DrawControls({ sections, setSections, drawMode, setDrawMode }: {
  sections: RoofSection[];
  setSections: (s: RoofSection[]) => void;
  drawMode: 'roof' | 'obstruction' | null;
  setDrawMode: (m: 'roof' | 'obstruction' | null) => void;
}) {
  const map = useMap();
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const drawHandlerRef = useRef<any>(null);

  useEffect(() => {
    const drawnItems = drawnItemsRef.current;
    map.addLayer(drawnItems);

    return () => {
      map.removeLayer(drawnItems);
    };
  }, [map]);

  useEffect(() => {
    if (drawHandlerRef.current) {
      drawHandlerRef.current.disable();
      drawHandlerRef.current = null;
    }

    if (!drawMode) return;

    const isObstruction = drawMode === 'obstruction';
    const activeSectionIdx = sections.length > 0 ? sections.length - 1 : 0;
    const color = isObstruction ? '#ef4444' : SECTION_COLORS[sections.filter(s => s.obstructions.length === 0 || isObstruction).length % SECTION_COLORS.length];

    const handler = new (L as any).Draw.Polygon(map, {
      shapeOptions: {
        color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
      },
      showArea: true,
    });
    handler.enable();
    drawHandlerRef.current = handler;

    const handleCreated = (e: any) => {
      const layer = e.layer as L.Polygon;
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(ll => ({ lat: ll.lat, lng: ll.lng }));
      drawnItemsRef.current.addLayer(layer);

      const metersPolygon = latlngToMeters(latlngs);
      const areaSqM = shoelaceAreaM2(metersPolygon);
      const areaSqFt = areaSqM * SQ_FT_PER_SQ_M;
      const usableFactor = 0.85; // ~15% lost to setbacks / mounting

      if (isObstruction) {
        // Add to last section's obstructions
        setSections(sections.map((sec, idx) =>
          idx === sections.length - 1
            ? { ...sec, obstructions: [...sec.obstructions, latlngs] }
            : sec
        ));
      } else {
        const newSection: RoofSection = {
          id: `section-${Date.now()}`,
          name: `Roof Section ${sections.length + 1}`,
          polygon: latlngs,
          tiltDeg: 10,
          azimuthDeg: 180,
          areaSqFt: Math.round(areaSqFt),
          usableAreaSqFt: Math.round(areaSqFt * usableFactor),
          color: SECTION_COLORS[sections.length % SECTION_COLORS.length],
          obstructions: [],
        };
        setSections([...sections, newSection]);
      }

      setDrawMode(null);
      handler.disable();
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    return () => { map.off(L.Draw.Event.CREATED, handleCreated); };
  }, [drawMode, map, sections, setSections, setDrawMode]);

  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    // Instant setView guarded against invalid coords / unsized container.
    // Leaflet's animated flyTo unprojects per frame and yields NaN LatLng
    // (crash) when the map mounts inside an animating/zero-size container.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = requestAnimationFrame(() => {
      try {
        map.invalidateSize();
        map.setView([lat, lng], 19, { animate: false });
      } catch { /* map unmounted */ }
    });
    return () => cancelAnimationFrame(id);
  }, [lat, lng, map]);
  return null;
}

export default function RoofMapper({ address, lat = 28.6139, lng = 77.209, onChange }: RoofMapperProps) {
  const [sections, setSections] = useState<RoofSection[]>([]);
  const [drawMode, setDrawMode] = useState<'roof' | 'obstruction' | null>(null);
  const [searchAddress, setSearchAddress] = useState(address || '');
  const [mapCenter, setMapCenter] = useState<[number, number]>([lat, lng]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  // Propagate changes up
  useEffect(() => { onChange(sections); }, [sections, onChange]);

  const handleSearch = useCallback(async () => {
    if (!searchAddress) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchAddress)}&format=json&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.length > 0) {
        setFlyTarget([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      }
    } catch(e) { console.error('Geocoding failed', e); }
  }, [searchAddress]);

  const removeSection = (id: string) => setSections(s => s.filter(sec => sec.id !== id));

  const updateSection = (id: string, updates: Partial<RoofSection>) => {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, ...updates } : sec));
  };

  const totalArea = sections.reduce((s, sec) => s + sec.areaSqFt, 0);
  const totalUsable = sections.reduce((s, sec) => s + sec.usableAreaSqFt, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[800px]">
      {/* Left Panel */}
      <div className="w-full lg:w-80 flex-shrink-0 overflow-y-auto space-y-3">
        <Card size="small" title="📍 Location" className="shadow-sm">
          <div className="flex gap-2">
            <Input
              placeholder="Enter address..."
              value={searchAddress}
              onChange={e => setSearchAddress(e.target.value)}
              onPressEnter={handleSearch}
              className="flex-1"
            />
            <Button icon={<AimOutlined />} onClick={handleSearch} />
          </div>
        </Card>

        <Card size="small" className="shadow-sm">
          <div className="flex gap-2">
            <Button
              type={drawMode === 'roof' ? 'primary' : 'default'}
              icon={<PlusOutlined />}
              onClick={() => setDrawMode(drawMode === 'roof' ? null : 'roof')}
              className="flex-1"
            >
              Draw Roof
            </Button>
            <Tooltip title="Draw on last section">
              <Button
                danger={drawMode === 'obstruction'}
                type={drawMode === 'obstruction' ? 'primary' : 'default'}
                icon={<ExclamationCircleOutlined />}
                onClick={() => setDrawMode(drawMode === 'obstruction' ? null : 'obstruction')}
                disabled={sections.length === 0}
                className="flex-1"
              >
                Obstruction
              </Button>
            </Tooltip>
          </div>
          {drawMode && (
            <div className={`mt-2 p-2 rounded text-xs font-medium ${drawMode === 'roof' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
              {drawMode === 'roof' ? '✏️ Click to trace roof corners. Double-click to finish.' : '⚠️ Click to trace obstruction. Double-click to finish.'}
            </div>
          )}
        </Card>

        {sections.length > 0 && (
          <div className="space-y-2">
            <Title level={5} className="!mb-2">Roof Sections</Title>
            {sections.map((sec, idx) => (
              <Card key={sec.id} size="small" className="shadow-sm border-l-4" style={{ borderLeftColor: sec.color }}>
                <div className="flex justify-between items-center mb-2">
                  <Input
                    value={sec.name}
                    onChange={e => updateSection(sec.id, { name: e.target.value })}
                    variant="borderless"
                    className="font-semibold p-0 text-sm"
                  />
                  <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeSection(sec.id)} />
                </div>

                <div className="text-xs text-apple-textMuted mb-2 space-y-1">
                  <div>Area: <strong>{sec.areaSqFt.toLocaleString()} sq ft</strong></div>
                  <div>Usable: <strong>{sec.usableAreaSqFt.toLocaleString()} sq ft</strong></div>
                  {sec.obstructions.length > 0 && (
                    <Tag color="red" className="text-xs">{sec.obstructions.length} obst.</Tag>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Text className="text-xs">Tilt</Text>
                    <Text className="text-xs font-bold">{sec.tiltDeg}°</Text>
                  </div>
                  <Slider
                    min={0} max={45} value={sec.tiltDeg}
                    onChange={v => updateSection(sec.id, { tiltDeg: Number(v) })}
                  />

                  <div className="flex justify-between items-center">
                    <Text className="text-xs">Azimuth</Text>
                    <Text className="text-xs font-bold">{sec.azimuthDeg}° {sec.azimuthDeg === 180 ? '(S)' : sec.azimuthDeg === 90 ? '(E)' : sec.azimuthDeg === 270 ? '(W)' : ''}</Text>
                  </div>
                  <Slider
                    min={0} max={360} value={sec.azimuthDeg}
                    onChange={v => updateSection(sec.id, { azimuthDeg: Number(v) })}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <Card size="small" className="bg-transparent shadow-sm">
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>Total Roof Area</span><strong>{totalArea.toLocaleString()} sq ft</strong></div>
              <div className="flex justify-between"><span>Net Usable Area</span><strong className="text-green-600">{totalUsable.toLocaleString()} sq ft</strong></div>
              <div className="flex justify-between"><span>Sections</span><strong>{sections.length}</strong></div>
            </div>
          </Card>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-transparent relative">
        <MapContainer center={mapCenter} zoom={19} scrollWheelZoom className="w-full h-full">
          {/* Google Maps Satellite tiles */}
          <TileLayer
            url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            subdomains={['0','1','2','3']}
            attribution="Google Maps"
            maxZoom={21}
          />
          {flyTarget && <FlyTo lat={flyTarget[0]} lng={flyTarget[1]} />}
          <DrawControls
            sections={sections}
            setSections={setSections}
            drawMode={drawMode}
            setDrawMode={setDrawMode}
          />
        </MapContainer>

        <div className="absolute top-4 left-4 z-[1000] bg-apple-cardLight dark:bg-apple-cardDark/90 backdrop-blur-sm px-3 py-2 rounded-lg text-xs shadow-sm">
          {drawMode ? (
            <span className="text-blue-600 font-semibold animate-pulse">Drawing mode active — click on map</span>
          ) : (
            <span className="text-apple-textMuted">Draw roof polygon to begin placement analysis</span>
          )}
        </div>
      </div>
    </div>
  );
}
