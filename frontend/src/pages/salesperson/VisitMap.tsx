import { useEffect, useState, useRef } from 'react';
import {
  Button, Card, Typography, Tag, Modal, Form, Input, Select,
  DatePicker, message, Drawer, Space, Divider, Badge, InputNumber,
} from 'antd';
import {
  AimOutlined, EnvironmentOutlined, PlusOutlined, PhoneOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CarOutlined,
  SwapOutlined, WarningOutlined, DollarOutlined, MailOutlined,
  ArrowLeftOutlined, CalendarOutlined, CloseCircleOutlined, SyncOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_START = { lat: 28.7041, lng: 77.1025, label: 'Rocker Solar, Rohini Sec 16, Delhi' };
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
const PROXIMITY_METERS = 200;
const TODAY = dayjs().format('YYYY-MM-DD');

const DEMO_VISITS = [
  { id: 'v1', leadId: 'demo-3', name: 'Amit Verma', phone: '+91 76543 21098', address: '78, Sector 62, Noida', lat: 28.6271, lng: 77.3776, scheduledAt: `${TODAY}T10:00:00Z`, status: 'PENDING', visitDate: TODAY },
  { id: 'v2', leadId: 'demo-5', name: 'Vikram Singh', phone: '+91 54321 09876', address: '56, Dwarka Sector 10, Delhi', lat: 28.5921, lng: 77.0460, scheduledAt: `${TODAY}T12:00:00Z`, status: 'PENDING', visitDate: TODAY },
  { id: 'v3', leadId: 'demo-4', name: 'Sunita Patel', phone: '+91 65432 10987', address: '23, NIT, Faridabad', lat: 28.4089, lng: 77.3178, scheduledAt: `${TODAY}T14:30:00Z`, status: 'COMPLETED', visitDate: TODAY },
];
const DEMO_NEARBY = [
  { id: 'n1', leadId: 'demo-7', name: 'Deepak Joshi', phone: '+91 32109 87654', address: '34, Rohini Sector 3, Delhi', lat: 28.7120, lng: 77.1050, scheduledAt: dayjs().add(1, 'day').format('YYYY-MM-DD') + 'T11:00:00Z', status: 'PENDING', visitDate: dayjs().add(1, 'day').format('YYYY-MM-DD') },
  { id: 'n2', leadId: 'demo-8', name: 'Kavita Rao', phone: '+91 21098 76543', address: '67, DLF Phase 2, Gurgaon', lat: 28.4595, lng: 77.0266, scheduledAt: dayjs().add(2, 'day').format('YYYY-MM-DD') + 'T10:00:00Z', status: 'PENDING', visitDate: dayjs().add(2, 'day').format('YYYY-MM-DD') },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

// ─── Google Maps loader ───────────────────────────────────────────────────────
declare global { interface Window { google: any; _gmapsReady: () => void; } }

function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!window.google?.maps);
  useEffect(() => {
    if (window.google?.maps) { setLoaded(true); return; }
    window._gmapsReady = () => setLoaded(true);
    if (!document.querySelector('#gm-script')) {
      const s = document.createElement('script');
      s.id = 'gm-script';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry&callback=_gmapsReady`;
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);
  return loaded;
}

// ─── Map Component ────────────────────────────────────────────────────────────
interface MapProps {
  start: { lat: number; lng: number; label: string };
  visits: any[];
  currentLoc: { lat: number; lng: number } | null;
  navTarget: any | null;
  onRouteReady: (legs: any[], waypointOrder?: number[]) => void;
}

function SalesMap({ start, visits, currentLoc, navTarget, onRouteReady }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const renderer = useRef<any>(null);
  const navRenderer = useRef<any>(null);
  const currentMarker = useRef<any>(null);
  const startMarker = useRef<any>(null);

    // Init map once
  useEffect(() => {
    if (!mapRef.current || !window.google || mapInst.current) return;
    mapInst.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: start.lat, lng: start.lng },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    
    // Add Traffic Layer
    const trafficLayer = new window.google.maps.TrafficLayer();
    trafficLayer.setMap(mapInst.current);

    renderer.current = new window.google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#1d4ed8', strokeWeight: 5 },
    });
    renderer.current.setMap(mapInst.current);
    navRenderer.current = new window.google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#16a34a', strokeWeight: 6 },
    });
    navRenderer.current.setMap(mapInst.current);
  }, [window.google?.maps]);

  // Draw full route whenever start or visits change
  useEffect(() => {
    if (!window.google || !mapInst.current) return;

    // Update start marker
    if (startMarker.current) startMarker.current.setMap(null);
    startMarker.current = new window.google.maps.Marker({
      position: { lat: start.lat, lng: start.lng },
      map: mapInst.current,
      title: start.label,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      label: { text: 'S', color: '#fff', fontWeight: 'bold', fontSize: '11px' },
    });

    const pending = visits.filter(v => v.lat && v.lng && v.status !== 'COMPLETED');
    if (pending.length === 0) { renderer.current?.setDirections({ routes: [] }); return; }

    const svc = new window.google.maps.DirectionsService();
    const waypoints = pending.slice(0, -1).map((v: any) => ({ location: { lat: v.lat, lng: v.lng }, stopover: true }));
    const dest = pending[pending.length - 1];

    svc.route({
      origin: { lat: start.lat, lng: start.lng },
      destination: { lat: dest.lat, lng: dest.lng },
      waypoints,
      optimizeWaypoints: true,
      travelMode: window.google.maps.TravelMode.TWO_WHEELER,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: 'bestguess'
      }
    }, (res: any, status: any) => {
      if (status === 'OK') {
        renderer.current.setDirections(res);
        onRouteReady(res.routes[0]?.legs || [], res.routes[0]?.waypoint_order);
      } else {
        // Fallback to driving if TWO_WHEELER not available
        svc.route({
          origin: { lat: start.lat, lng: start.lng },
          destination: { lat: dest.lat, lng: dest.lng },
          waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess'
          }
        }, (res2: any, s2: any) => {
          if (s2 === 'OK') { renderer.current.setDirections(res2); onRouteReady(res2.routes[0]?.legs || [], res2.routes[0]?.waypoint_order); }
        });
      }
    });
  }, [start.lat, start.lng, visits.map(v => v.id + v.status).join(',')]);

  // Navigation mode: route from current location to navTarget
  useEffect(() => {
    if (!window.google || !mapInst.current) return;
    if (!navTarget || !currentLoc) { navRenderer.current?.setDirections({ routes: [] }); return; }

    const svc = new window.google.maps.DirectionsService();
    svc.route({
      origin: { lat: currentLoc.lat, lng: currentLoc.lng },
      destination: { lat: navTarget.lat, lng: navTarget.lng },
      travelMode: window.google.maps.TravelMode.TWO_WHEELER,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: 'bestguess'
      }
    }, (res: any, status: any) => {
      if (status === 'OK') {
        navRenderer.current.setDirections(res);
        mapInst.current.setZoom(15);
        mapInst.current.panTo({ lat: currentLoc.lat, lng: currentLoc.lng });
      } else {
        svc.route({
          origin: { lat: currentLoc.lat, lng: currentLoc.lng },
          destination: { lat: navTarget.lat, lng: navTarget.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess'
          }
        }, (res2: any, s2: any) => {
          if (s2 === 'OK') { navRenderer.current.setDirections(res2); mapInst.current.setZoom(15); }
        });
      }
    });
  }, [navTarget?.id, currentLoc?.lat, currentLoc?.lng]);

  // Live current location marker
  useEffect(() => {
    if (!window.google || !mapInst.current || !currentLoc) return;
    if (currentMarker.current) {
      currentMarker.current.setPosition({ lat: currentLoc.lat, lng: currentLoc.lng });
    } else {
      currentMarker.current = new window.google.maps.Marker({
        position: { lat: currentLoc.lat, lng: currentLoc.lng },
        map: mapInst.current,
        title: 'You are here',
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          rotation: 0,
        },
        zIndex: 999,
      });
    }
  }, [currentLoc?.lat, currentLoc?.lng]);

  return <div ref={mapRef} className="w-full h-full" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VisitMap() {
  const queryClient = useQueryClient();
  const mapsLoaded = useGoogleMaps();

  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [startLocation, setStartLocation] = useState(DEFAULT_START);
  const [changeStartOpen, setChangeStartOpen] = useState(false);
  const [customStartForm] = Form.useForm();

  // Navigation mode
  const [navTarget, setNavTarget] = useState<any>(null);
  const [navLegs, setNavLegs] = useState<any[]>([]);
  const [optimizedOrder, setOptimizedOrder] = useState<number[]>([]);

  // Distances — recalculated from currentLoc OR startLocation
  const [distances, setDistances] = useState<Record<string, number>>({});
  
  // Track mock visits added to today
  const [mockAddedToToday, setMockAddedToToday] = useState<string[]>([]);

  // Outcome modal
  const [outcomeVisit, setOutcomeVisit] = useState<any>(null);
  const [outcomeStep, setOutcomeStep] = useState<'choice' | 'followup' | 'convert'>('choice');
  const [outcomeForm] = Form.useForm();
  const [convertForm] = Form.useForm();

  const { data: routeData } = useQuery({
    queryKey: ['my-route'],
    queryFn: async () => (await backendApi.get('/visits/my-route')).data.data,
    refetchInterval: 60000,
  });

  const todayVisits: any[] = (() => {
    let api = (routeData || []).filter((v: any) => dayjs(v.scheduledAt).format('YYYY-MM-DD') === TODAY);
    if (api.length === 0) api = DEMO_VISITS.map(v => ({...v}));
    
    // Add mock moved items
    const movedMocks = DEMO_NEARBY.filter(v => mockAddedToToday.includes(v.id)).map(v => ({...v, visitDate: TODAY, scheduledAt: new Date().toISOString()}));
    api = [...api, ...movedMocks];
    
    const pending = api.filter((v: any) => v.lat && v.lng && v.status !== 'COMPLETED');
    const others = api.filter((v: any) => !v.lat || !v.lng || v.status === 'COMPLETED');
    
    // Sort pending based on optimized order from DirectionsService
    if (optimizedOrder.length > 0 && pending.length > 1) {
      // The last element is the destination, which is not in waypoint_order
      const targetDest = pending[pending.length - 1];
      const waypointsUnsorted = pending.slice(0, -1);
      const waypointsSorted = optimizedOrder.map(i => waypointsUnsorted[i]);
      api = [...waypointsSorted, targetDest, ...others];
    }
    
    return api;
  })();

  const nearbyVisits: any[] = (() => {
    let api = (routeData || []).filter((v: any) => dayjs(v.scheduledAt).format('YYYY-MM-DD') !== TODAY);
    if (api.length === 0) api = DEMO_NEARBY.filter(v => !mockAddedToToday.includes(v.id));
    return api;
  })();

  // Recalculate distances whenever currentLoc OR startLocation changes
  useEffect(() => {
    const origin = currentLoc || startLocation;
    const dists: Record<string, number> = {};
    [...todayVisits, ...nearbyVisits].forEach((v: any) => {
      if (v.lat && v.lng) dists[v.id] = Math.round(haversine(origin.lat, origin.lng, v.lat, v.lng));
    });
    setDistances(dists);
  }, [currentLoc?.lat, currentLoc?.lng, startLocation.lat, startLocation.lng, todayVisits.length]);

  // GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const isNearby = (v: any) => {
    if (!currentLoc || !v.lat || !v.lng) return false;
    return haversine(currentLoc.lat, currentLoc.lng, v.lat, v.lng) <= PROXIMITY_METERS;
  };

  // Next pending visit (nearest)
  const nextVisit = todayVisits.find(v => v.status !== 'COMPLETED' && v.lat && v.lng);

  const addToTodayMutation = useMutation({
    mutationFn: async (visitId: string) => {
      if (visitId.startsWith('n') || visitId.startsWith('v')) return { isMock: true, id: visitId };
      try { return await backendApi.patch(`/visits/${visitId}`, { scheduledAt: new Date().toISOString() }); }
      catch { return {}; }
    },
    onSuccess: (data: any) => { 
      message.success('Added to today\'s route!'); 
      if (data?.isMock) {
        setMockAddedToToday(prev => [...prev, data.id]);
      }
      queryClient.invalidateQueries(['my-route'] as any); 
    },
  });

  const outcomeSubmitMutation = useMutation({
    mutationFn: async (payload: any) => {
      try { return await backendApi.post(`/visits/${payload.visitId}/outcome`, payload); }
      catch { return payload; }
    },
    onSuccess: async (_: any, vars: any) => {
      if (vars.outcome === 'CONVERTED') message.success('Lead converted! Invoice sent.');
      else if (vars.outcome === 'FOLLOW_UP') message.success('Follow-up scheduled!');
      else message.info('Outcome saved.');
      await queryClient.invalidateQueries(['my-route'] as any);
      
      const pendingCount = todayVisits.filter(v => v.id !== outcomeVisit?.id && v.status !== 'COMPLETED').length;
      if (pendingCount === 0 && todayVisits.length > 0) {
        const stops = [
          { lat: startLocation.lat, lng: startLocation.lng, name: startLocation.label },
          ...todayVisits.map(v => ({ lat: v.lat, lng: v.lng, name: v.name || v.customer?.name || v.lead?.name }))
        ].filter(s => s.lat && s.lng);
        
        backendApi.post('/travel-logs', {
          date: dayjs().format('YYYY-MM-DD'),
          stops,
          notes: 'Auto-submitted after completing all sales visits'
        }).then(() => {
          message.success('Daily travel log auto-submitted to accounting!');
        }).catch(console.error);
      }

      setOutcomeVisit(null); setOutcomeStep('choice');
      outcomeForm.resetFields(); convertForm.resetFields();
    },
  });

  const handleOutcome = (choice: string) => {
    if (choice === 'FOLLOW_UP') setOutcomeStep('followup');
    else if (choice === 'CONVERTED') setOutcomeStep('convert');
    else outcomeSubmitMutation.mutate({ visitId: outcomeVisit.id, leadId: outcomeVisit.leadId, outcome: 'NOT_INTERESTED' });
  };

  const handleFollowUpSubmit = async () => {
    const vals = await outcomeForm.validateFields();
    outcomeSubmitMutation.mutate({ visitId: outcomeVisit.id, leadId: outcomeVisit.leadId, outcome: 'FOLLOW_UP', followUpDate: vals.followUpDate.format('YYYY-MM-DD') });
  };

  const handleConvertSubmit = async () => {
    const vals = await convertForm.validateFields();
    outcomeSubmitMutation.mutate({ visitId: outcomeVisit.id, leadId: outcomeVisit.leadId, outcome: 'CONVERTED', ...vals, sendInvoice: true });
  };

  const statusColor: Record<string, string> = { PENDING: 'default', COMPLETED: 'green', CHECKED_IN: 'blue' };

  // ── Navigation mode UI ──────────────────────────────────────────────────────
  if (navTarget) {
    const leg = navLegs[0];
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Nav Header */}
        <div className="flex items-center gap-3 p-3 bg-blue-600 text-white flex-shrink-0">
          <Button icon={<ArrowLeftOutlined />} type="text" className="text-white hover:text-blue-200" onClick={() => { setNavTarget(null); setNavLegs([]); }} />
          <div className="flex-1">
            <div className="font-bold text-base">{navTarget.name}</div>
            <div className="text-xs opacity-80">{navTarget.address}</div>
          </div>
          {leg && (
            <div className="text-right">
              <div className="font-bold text-lg">{leg.distance?.text}</div>
              <div className="text-xs opacity-80">{leg.duration?.text}</div>
            </div>
          )}
        </div>

        {/* Turn-by-turn steps */}
        {leg?.steps?.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 flex-shrink-0 border-b border-blue-200 overflow-x-auto">
            <div className="flex gap-3 text-xs text-blue-800 dark:text-blue-300 whitespace-nowrap">
              {leg.steps.slice(0, 4).map((step: any, i: number) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                  <span dangerouslySetInnerHTML={{ __html: step.instructions?.replace(/<[^>]+>/g, '') || '' }} />
                  <span className="text-blue-600 font-medium">({step.distance?.text})</span>
                  {i < 3 && <span className="text-blue-400">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Full screen map in nav mode */}
        <div className="flex-1 min-h-0">
          {mapsLoaded ? (
            <SalesMap
              start={startLocation}
              visits={todayVisits}
              currentLoc={currentLoc}
              navTarget={navTarget}
              onRouteReady={(legs, order) => {
                setNavLegs(legs);
                if (order) setOptimizedOrder(order);
              }}
            />
          ) : <div className="w-full h-full flex items-center justify-center text-gray-400">Loading map...</div>}
        </div>

        {/* Bottom: proximity unlock */}
        <div className="p-4 bg-white dark:bg-apple-cardDark border-t flex-shrink-0">
          {isNearby(navTarget) ? (
            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              className="h-12 bg-blue-600 hover:bg-blue-500 border-none text-base font-semibold"
              onClick={() => { setOutcomeVisit(navTarget); setOutcomeStep('choice'); }}
            >
              You've arrived — Log Outcome
            </Button>
          ) : (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{distances[navTarget.id] !== undefined ? fmtDist(distances[navTarget.id]) : '...'}</div>
              <div className="text-xs text-gray-500">to destination • Log Outcome unlocks within 200m</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Normal route view ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0 flex-wrap gap-2">
        <div>
          <Title level={4} className="!mb-0">Today's Sales Route</Title>
          <Text type="secondary" className="text-xs">
            <EnvironmentOutlined className="mr-1" />
            From: <span className="font-medium text-blue-600">{startLocation.label}</span>
          </Text>
        </div>
        <Space wrap>
          <Button icon={<SwapOutlined />} onClick={() => setChangeStartOpen(true)}>Change Start</Button>
          <Tag color={currentLoc ? 'green' : 'orange'} icon={<AimOutlined />}>
            {currentLoc ? 'GPS Active' : 'No GPS'}
          </Tag>
          {nextVisit && (
            <Button
              type="primary"
              icon={<CarOutlined />}
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${nextVisit.lat},${nextVisit.lng}&dir_action=navigate`, '_blank')}
              className="bg-blue-600 hover:bg-blue-500 border-none"
            >
              Navigate to Next
            </Button>
          )}
        </Space>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden shadow-sm min-h-[300px] lg:min-h-0 bg-slate-100">
          {mapsLoaded ? (
            <SalesMap
              start={startLocation}
              visits={todayVisits}
              currentLoc={currentLoc}
              navTarget={null}
              onRouteReady={(legs, order) => {
                setNavLegs(legs);
                if (order) setOptimizedOrder(order);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center"><CarOutlined className="text-4xl mb-2" /><div>Loading Google Maps...</div></div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Today's Visits */}
          <Card
            title={<span className="font-semibold">Today's Sales Visits <Badge count={todayVisits.length} className="ml-2" /></span>}
            size="small"
          >
            <div className="space-y-3">
              {todayVisits.map((v: any, idx: number) => {
                const dist = distances[v.id];
                const near = isNearby(v);
                return (
                  <div key={v.id} className={`p-3 rounded-lg border transition-all ${near ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-slate-50 dark:bg-white/5'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate" title={v.name || v.customer?.name || v.lead?.name}>{v.name || v.customer?.name || v.lead?.name}</div>
                          <div className="text-xs text-gray-500 truncate" title={v.address}>{v.address}</div>
                          {v.scheduledAt && (
                            <div className="text-xs text-blue-600 mt-0.5">
                              <ClockCircleOutlined className="mr-1" />{dayjs(v.scheduledAt).format('hh:mm A')}
                            </div>
                          )}
                        </div>
                      </div>
                      <Tag color={statusColor[v.status] || 'default'} className="text-xs flex-shrink-0">{v.status}</Tag>
                    </div>

                    <div className={`text-xs mt-2 font-medium flex items-center gap-1 ${near ? 'text-blue-600' : 'text-gray-500'}`}>
                      <EnvironmentOutlined />
                      {dist !== undefined ? fmtDist(dist) : '...'} away
                      {near && <span className="text-blue-600 font-bold"> — You're here!</span>}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button size="small" icon={<PhoneOutlined />} href={`tel:${v.phone}`} className="flex-1 min-w-[70px] flex items-center justify-center">Call</Button>
                      {v.status !== 'COMPLETED' && (
                        <Button
                          size="small"
                          icon={<CarOutlined />}
                          className="flex-1 min-w-[90px] flex items-center justify-center"
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}&dir_action=navigate`, '_blank')}
                        >
                          Navigate
                        </Button>
                      )}
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        disabled={!near || v.status === 'COMPLETED'}
                        className="flex-[1.5] min-w-[100px] flex items-center justify-center"
                        onClick={() => { setOutcomeVisit(v); setOutcomeStep('choice'); }}
                      >
                        {v.status === 'COMPLETED' ? 'Done' : near ? 'Outcome' : `${dist !== undefined ? fmtDist(dist) : '?'}`}
                      </Button>
                      <Button
                        size="small"
                        type="default"
                        className="flex-1 min-w-[100px] flex items-center justify-center border-orange-300 text-orange-500"
                        onClick={() => { setOutcomeVisit(v); setOutcomeStep('choice'); }}
                        title="Demo Outcome (Ignores 200m limit)"
                      >
                        Demo Outcome
                      </Button>
                    </div>
                    {!near && v.status !== 'COMPLETED' && (
                      <div className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                        <WarningOutlined /> Within 200m to log outcome
                      </div>
                    )}
                  </div>
                );
              })}
              {todayVisits.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">No sales visits today</div>}
            </div>
          </Card>

          {/* Nearby from Other Days */}
          <Card title={<span className="font-semibold text-sm">Nearby — Other Days <Badge count={nearbyVisits.length} className="ml-2" /></span>} size="small">
            <div className="space-y-3">
              {nearbyVisits.map((v: any) => {
                const dist = distances[v.id];
                return (
                  <div key={v.id} className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-transparent">
                    <div className="font-semibold text-sm truncate" title={v.name || v.customer?.name || v.lead?.name}>{v.name || v.customer?.name || v.lead?.name}</div>
                    <div className="text-xs text-gray-500 truncate" title={v.address}>{v.address}</div>
                    <div className="text-xs text-purple-600 mt-0.5"><CalendarOutlined className="mr-1" />{dayjs(v.visitDate || v.scheduledAt).format('MMM DD')}</div>
                    {dist !== undefined && (
                      <div className="text-xs text-gray-500 mt-0.5"><EnvironmentOutlined className="mr-1" />{fmtDist(dist)} away</div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button size="small" icon={<PhoneOutlined />} href={`tel:${v.phone}`} className="flex-1 min-w-[70px] flex items-center justify-center">Call</Button>
                      <Button size="small" icon={<PlusOutlined />} className="flex-[1.5] min-w-[110px] flex items-center justify-center" onClick={() => addToTodayMutation.mutate(v.id)} loading={addToTodayMutation.isPending}>Add to Today</Button>
                    </div>
                  </div>
                );
              })}
              {nearbyVisits.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">No nearby visits from other days</div>}
            </div>
          </Card>
        </div>
      </div>

      {/* Change Start Drawer */}
      <Drawer
        title="Change Starting Location"
        placement="right"
        width={400}
        open={changeStartOpen}
        onClose={() => setChangeStartOpen(false)}
        extra={
          <Button type="primary" onClick={async () => {
            const vals = await customStartForm.validateFields();
            setStartLocation({ lat: parseFloat(vals.lat), lng: parseFloat(vals.lng), label: vals.label });
            setChangeStartOpen(false);
            message.success('Starting location updated — route recalculating...');
          }}>
            Set & Recalculate
          </Button>
        }
      >
        <Form form={customStartForm} layout="vertical" initialValues={{ label: DEFAULT_START.label, lat: DEFAULT_START.lat, lng: DEFAULT_START.lng }}>
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            Default: Rocker Solar, Rohini Sec 16, Delhi. Changing this will recalculate the full route and distances.
          </div>
          <Form.Item label="Location Name" name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Home, Client Office..." />
          </Form.Item>
          <Form.Item label="Latitude" name="lat" rules={[{ required: true }]}>
            <Input type="number" step="any" />
          </Form.Item>
          <Form.Item label="Longitude" name="lng" rules={[{ required: true }]}>
            <Input type="number" step="any" />
          </Form.Item>
          <Divider />
          <Button block icon={<AimOutlined />} onClick={() => {
            if (currentLoc) customStartForm.setFieldsValue({ lat: currentLoc.lat, lng: currentLoc.lng, label: 'My Current Location' });
            else message.warning('GPS not available yet');
          }}>
            Use My Current GPS Location
          </Button>
        </Form>
      </Drawer>

      {/* Outcome Modal */}
      <Modal
        title={outcomeStep === 'choice' ? `Sales Visit — ${outcomeVisit?.name}` : outcomeStep === 'followup' ? 'Schedule Follow-up' : 'Convert to Customer'}
        open={!!outcomeVisit}
        onCancel={() => { setOutcomeVisit(null); setOutcomeStep('choice'); }}
        footer={null}
        width={480}
      >
        {outcomeStep === 'choice' && (
          <div className="space-y-3 py-2">
            <Text type="secondary" className="text-sm">What was the outcome of this sales visit?</Text>
            <div className="grid gap-3 mt-4">
              <Button size="large" type="primary" icon={<CheckCircleOutlined />} className="h-14 text-base bg-blue-600 hover:bg-blue-500 border-none" onClick={() => handleOutcome('CONVERTED')}>
                Converted — Customer Agreed
              </Button>
              <Button size="large" icon={<SyncOutlined />} className="h-14 text-base border-blue-400 text-blue-600" onClick={() => handleOutcome('FOLLOW_UP')}>
                Follow Up Needed
              </Button>
              <Button size="large" danger icon={<CloseCircleOutlined />} className="h-14 text-base" onClick={() => handleOutcome('NOT_INTERESTED')} loading={outcomeSubmitMutation.isPending}>
                Not Interested
              </Button>
            </div>
          </div>
        )}

        {outcomeStep === 'followup' && (
          <Form form={outcomeForm} layout="vertical" className="mt-2">
            <Form.Item label="Follow-up Date" name="followUpDate" rules={[{ required: true, message: 'Please select a date' }]}>
              <DatePicker className="w-full" disabledDate={d => d.isBefore(dayjs(), 'day')} />
            </Form.Item>
            <Form.Item label="Notes (optional)" name="notes">
              <TextArea rows={3} placeholder="What to discuss on follow-up..." />
            </Form.Item>
            <div className="flex gap-2 justify-end mt-2">
              <Button onClick={() => setOutcomeStep('choice')}>Back</Button>
              <Button type="primary" onClick={handleFollowUpSubmit} loading={outcomeSubmitMutation.isPending}>Save Follow-up</Button>
            </div>
          </Form>
        )}

        {outcomeStep === 'convert' && (
          <Form form={convertForm} layout="vertical" className="mt-2">
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              <CheckCircleOutlined className="mr-2" />
              Lead converts to customer. Invoice sent to email & phone.
            </div>
            <Form.Item label="Agreed Amount (₹)" name="agreedAmount" rules={[{ required: true }]}>
              <InputNumber className="w-full" prefix="₹" min={0} step={1000} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item label="Payment Taken Now (₹)" name="paymentTaken" rules={[{ required: true }]}>
              <InputNumber className="w-full" prefix="₹" min={0} step={1000} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
            <Form.Item label="Payment Mode" name="paymentMode" rules={[{ required: true }]}>
              <Select placeholder="Select mode">
                <Option value="CASH">Cash</Option>
                <Option value="UPI">UPI</Option>
                <Option value="BANK_TRANSFER">Bank Transfer</Option>
                <Option value="CHEQUE">Cheque</Option>
                <Option value="CARD">Card</Option>
              </Select>
            </Form.Item>
            <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
              <MailOutlined /> Invoice → {outcomeVisit?.email || 'email'} & {outcomeVisit?.phone}
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setOutcomeStep('choice')}>Back</Button>
              <Button type="primary" icon={<DollarOutlined />} onClick={handleConvertSubmit} loading={outcomeSubmitMutation.isPending} className="bg-blue-600 hover:bg-blue-500 border-none">
                Convert & Send Invoice
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
