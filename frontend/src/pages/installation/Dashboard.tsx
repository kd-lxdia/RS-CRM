import React from 'react';
import { Row, Col, Statistic, List, Button, Tag, Progress } from 'antd';
import { ClipboardList, Hammer, CalendarDays, CheckCircle, Cloud, Sun, CloudRain } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { DashboardCard } from '../../components/DashboardCard';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const routePoints: [number, number][] = [
  [28.6139, 77.2090], // Delhi Start
  [28.5355, 77.2410],
  [28.4595, 77.0266],
  [28.4089, 77.3178]  // End
];

const mockStats = {
  pendingSurveys: 12,
  pendingInstalls: 8,
  todaysVisits: 4,
  completedMonth: 15
};

const dashboardData = [
  { id: 1, name: 'Rajesh Kumar', time: '09:00 AM', type: 'Site Survey' },
  { id: 2, name: 'Amit Sharma', time: '11:30 AM', type: 'Installation' },
  { id: 3, name: 'Priya Singh', time: '02:00 PM', type: 'Site Survey' },
];

const mockMaterialData = [
  { name: 'Amit Sharma', readiness: 100, pendingItems: 0 },
  { name: 'Khushi Gupta', readiness: 85, pendingItems: 2 },
  { name: 'Vikram Singh', readiness: 40, pendingItems: 5 },
  { name: 'Neha Patel', readiness: 10, pendingItems: 12 },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Fetch Installation Stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['inst-stats'],
    queryFn: async () => {
      // return backendApi.get('/api/dashboard/installation').then(res => res.data.data)
      return mockStats;
    },
    refetchInterval: 30000
  });

  // Fetch Weather for Delhi
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: ['delhi-weather'],
    queryFn: async () => {
      // Using open-meteo as a free no-key alternative to OpenWeatherMap
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata');
      const data = await res.json();
      return data;
    },
    refetchInterval: 600000 // 10 mins
  });

  const getWeatherIcon = (code: number) => {
    if (code === 0 || code === 1) return <Sun size={32} className="text-amber-500" />;
    if (code >= 50 && code <= 67) return <CloudRain size={32} className="text-blue-500" />;
    return <Cloud size={32} className="text-apple-gray" />;
  };

  const getWeatherText = (code: number) => {
    if (code === 0 || code === 1) return 'Clear / Sunny';
    if (code >= 50 && code <= 67) return 'Rainy';
    if (code >= 2 && code <= 3) return 'Partly Cloudy';
    return 'Cloudy';
  };

  const stats = statsData || mockStats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Installation Dashboard</h1>

      {/* STATS ROW */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-orange-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><ClipboardList size={16} className="mr-2"/> Pending Surveys</span>}
              value={stats.pendingSurveys} 
              valueStyle={{ fontWeight: 'bold' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-blue-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Hammer size={16} className="mr-2"/> Pending Installs</span>}
              value={stats.pendingInstalls} 
              valueStyle={{ fontWeight: 'bold' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-purple-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><CalendarDays size={16} className="mr-2"/> Today's Visits</span>}
              value={stats.todaysVisits} 
              valueStyle={{ fontWeight: 'bold' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-green-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><CheckCircle size={16} className="mr-2"/> Completed This Month</span>}
              value={stats.completedMonth} 
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* ROUTE MAP FLAG */}
        <Col xs={24}>
          <DashboardCard 
            title="Today's Visits Map" 
            bodyStyle={{ padding: 0 }}
            extra={
              <Button 
                type="primary" 
                onClick={() => navigate('/installation/map')}
                className="bg-blue-600 hover:bg-blue-500 border-none"
              >
                Open Today's Route Map
              </Button>
            }
          >
            <div style={{ height: '350px', width: '100%', position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/installation/map')}>
              <MapContainer center={[28.6139, 77.2090]} zoom={10} style={{ height: '100%', width: '100%', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', zIndex: 0 }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {routePoints.map((pos, idx) => (
                  <Marker key={idx} position={pos}>
                    <Popup>Visit Stop {idx + 1}</Popup>
                  </Marker>
                ))}
                <Polyline positions={routePoints} color="blue" weight={3} dashArray="5, 10" />
              </MapContainer>
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg z-[1000] pointer-events-none">
                <span className="text-sm font-semibold text-blue-600">Click to open interactive route map with navigation</span>
              </div>
            </div>
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* MATERIAL READINESS */}
        <Col xs={24} lg={10}>
          <DashboardCard title="Material Readiness (Upcoming Installs)" className="h-full">
            <div className="space-y-4 pt-2">
              {mockMaterialData.map((item, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-apple-textLight dark:text-apple-textDark dark:text-slate-300">{item.name}</span>
                    {item.readiness === 100 ? (
                      <span className="text-emerald-500 font-medium">Ready for Dispatch</span>
                    ) : (
                      <span className="text-amber-500 font-medium">{item.pendingItems} items pending</span>
                    )}
                  </div>
                  <Progress 
                    percent={item.readiness} 
                    status={item.readiness === 100 ? 'success' : 'active'}
                    strokeColor={item.readiness === 100 ? '#10b981' : '#f59e0b'}
                  />
                </div>
              ))}
            </div>
          </DashboardCard>
        </Col>

        {/* WEATHER WIDGET */}
        <Col xs={24} lg={6}>
          <DashboardCard title="Delhi Weather" loading={weatherLoading} className="h-full">
             <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                {weatherData?.current ? (
                  <>
                    <div className="text-4xl font-bold">{weatherData.current.temperature_2m}°C</div>
                    <div className="flex flex-col items-center">
                      {getWeatherIcon(weatherData.current.weather_code)}
                      <span className="text-apple-textMuted font-medium mt-2">{getWeatherText(weatherData.current.weather_code)}</span>
                    </div>
                    {weatherData.daily && (
                      <div className="text-xs text-apple-gray mt-4 flex gap-4">
                        <span>Min: {weatherData.daily.temperature_2m_min[0]}°C</span>
                        <span>Max: {weatherData.daily.temperature_2m_max[0]}°C</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-apple-gray">Weather data unavailable</div>
                )}
             </div>
          </DashboardCard>
        </Col>

        {/* AGENDA */}
        <Col xs={24} lg={8}>
          <DashboardCard title="Today's Agenda" className="h-full">
            <List
              itemLayout="horizontal"
              dataSource={dashboardData}
              renderItem={item => (
                <List.Item
                  actions={[<Button key="navigate" size="small" type="primary" ghost onClick={() => navigate('/installation/map')}>Navigate</Button>]}
                >
                  <List.Item.Meta
                    title={<span className="font-semibold">{item.name}</span>}
                    description={
                      <div>
                        {item.time} - <Tag color={item.type === 'Installation' ? 'blue' : 'orange'}>{item.type}</Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </DashboardCard>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
