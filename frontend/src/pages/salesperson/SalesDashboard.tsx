import { Col, Row, Statistic, Button, List, Tag, Avatar, Typography } from 'antd';
import { EnvironmentOutlined, PlusOutlined, UserOutlined, PhoneOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Map, MapPin, Calendar, Trophy, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState, useMemo } from 'react';
import VisitSchedulingModal from '../../components/VisitSchedulingModal';
import { DashboardCard } from '../../components/DashboardCard';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const DEMO_LEADS = [
  { id: 'demo-1', name: 'Rajesh Kumar', phone: '+91 98765 43210', city: 'New Delhi', address: '12, Lajpat Nagar, New Delhi', status: 'NEW', email: 'rajesh.kumar@gmail.com', leadCode: 'LD-001' },
  { id: 'demo-2', name: 'Priya Sharma', phone: '+91 87654 32109', city: 'Gurgaon', address: '45, Sector 14, Gurgaon', status: 'FOLLOW_UP', email: 'priya.sharma@yahoo.com', leadCode: 'LD-002' },
  { id: 'demo-3', name: 'Amit Verma', phone: '+91 76543 21098', city: 'Noida', address: '78, Sector 62, Noida', status: 'VISIT_SCHEDULED', email: 'amit.verma@outlook.com', leadCode: 'LD-003' },
  { id: 'demo-4', name: 'Sunita Patel', phone: '+91 65432 10987', city: 'Faridabad', address: '23, NIT, Faridabad', status: 'PROPOSAL_SENT', email: 'sunita.patel@gmail.com', leadCode: 'LD-004' },
  { id: 'demo-5', name: 'Vikram Singh', phone: '+91 54321 09876', city: 'New Delhi', address: '56, Dwarka Sector 10, New Delhi', status: 'NEGOTIATION', email: 'vikram.singh@gmail.com', leadCode: 'LD-005' },
  { id: 'demo-6', name: 'Meena Agarwal', phone: '+91 43210 98765', city: 'Ghaziabad', address: '89, Indirapuram, Ghaziabad', status: 'WON', email: 'meena.agarwal@gmail.com', leadCode: 'LD-006' },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'default',
  FOLLOW_UP: 'blue',
  VISIT_SCHEDULED: 'orange',
  PROPOSAL_SENT: 'purple',
  NEGOTIATION: 'magenta',
  WON: 'green',
  LOST: 'red',
};

const { Title } = Typography;

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Fetch todays route stats (polling every 30s)
  const { data: routeData, isLoading: routeLoading } = useQuery({
    queryKey: ['my-route'],
    queryFn: async () => {
      const res = await backendApi.get('/visits/my-route');
      return res.data.data;
    },
    refetchInterval: 30000
  });

  // Fetch leads pipeline summary (polling every 30s)
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['my-leads-summary'],
    queryFn: async () => {
      const res = await backendApi.get('/leads', { params: { limit: 100 } });
      return res.data.data.leads;
    },
    refetchInterval: 30000
  });

  const visits = routeData || [];
  const leads = (leadsData && leadsData.length > 0) ? leadsData : DEMO_LEADS;
  
  const pipelineData = [
    { name: 'New', count: leads.filter((l: any) => l.status === 'NEW').length, color: '#94a3b8' },
    { name: 'Follow-up', count: leads.filter((l: any) => l.status === 'FOLLOW_UP').length, color: '#3b82f6' },
    { name: 'Scheduled', count: leads.filter((l: any) => l.status === 'VISIT_SCHEDULED').length, color: '#f59e0b' },
    { name: 'Proposal', count: leads.filter((l: any) => l.status === 'PROPOSAL_SENT').length, color: '#8b5cf6' },
    { name: 'Negotiation', count: leads.filter((l: any) => l.status === 'NEGOTIATION').length, color: '#ec4899' },
    { name: 'Won', count: leads.filter((l: any) => l.status === 'WON').length, color: '#10b981' },
  ];

  // Mock Sparkline data for weekly performance vs last week
  const sparklineData = [
    { day: 'Mon', current: 12, prev: 8 },
    { day: 'Tue', current: 19, prev: 15 },
    { day: 'Wed', current: 15, prev: 20 },
    { day: 'Thu', current: 22, prev: 18 },
    { day: 'Fri', current: 30, prev: 25 },
    { day: 'Sat', current: 10, prev: 12 },
    { day: 'Sun', current: 0, prev: 0 },
  ];

  // Mock distance and closest unvisited lead
  const distanceTraveled = useMemo(() => {
    // Ideally calculated from check-in logs. Mocking realistic value based on checked in visits
    const completed = visits.filter((v: any) => v.status === 'CHECKED_IN' || v.status === 'COMPLETED').length;
    return (completed * 14.5).toFixed(1);
  }, [visits]);

  const closestLead = useMemo(() => {
    const unvisited = leads.filter((l: any) => l.status === 'NEW' || l.status === 'FOLLOW_UP');
    if (unvisited.length === 0) return null;
    return { name: unvisited[0]?.name || 'Acme Corp', distance: '4.2 km' };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold mb-0 flex items-center"><Briefcase className="mr-2 text-indigo-600"/> Sales Console</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <DashboardCard loading={leadsLoading} className="border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Map size={16} className="mr-2"/> Distance Traveled Today</span>} 
              value={distanceTraveled} 
              suffix="km" 
              valueStyle={{ fontWeight: 'bold', color: '#3b82f6' }} 
            />
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={leadsLoading} className="border-l-4 border-l-amber-500 bg-amber-50/10 dark:bg-amber-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><MapPin size={16} className="mr-2"/> Closest Unvisited Lead</span>} 
              value={closestLead?.name || 'N/A'} 
              formatter={(val) => <div className="text-xl overflow-hidden text-ellipsis whitespace-nowrap font-bold text-slate-700 dark:text-slate-200">{val}</div>} 
            />
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">{closestLead?.distance || ''} away</div>
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={routeLoading} className="border-l-4 border-l-indigo-500 bg-indigo-50/10 dark:bg-indigo-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Calendar size={16} className="mr-2"/> Today's Visits</span>} 
              value={visits.length} 
              valueStyle={{ fontWeight: 'bold', color: '#6366f1' }} 
            />
          </DashboardCard>
        </Col>
        <Col xs={12} md={6}>
          <DashboardCard loading={leadsLoading} className="border-l-4 border-l-emerald-500 bg-emerald-50/10 dark:bg-emerald-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Trophy size={16} className="mr-2"/> Won This Month</span>} 
              value={pipelineData[5].count} 
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }} 
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <DashboardCard title="Weekly Performance (vs Last Wk)" className="h-full">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="current" stroke="#1890ff" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="prev" stroke="#d9d9d9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <RechartsTooltip />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs mt-2 text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-blue-500 block"></span> This Wk</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1 bg-gray-300 block border-dashed border-b-2"></span> Last Wk</span>
            </div>
          </DashboardCard>
        </Col>
        
        <Col xs={24} lg={8}>
          <DashboardCard title="My Territory Zone" className="h-full">
            <div className="h-48 w-full rounded-md overflow-hidden z-0 relative cursor-pointer" onClick={() => navigate('/salesperson/route')}>
              <MapContainer 
                center={[28.6139, 77.2090]} // New Delhi
                zoom={10} 
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Circle center={[28.6139, 77.2090]} radius={8000} pathOptions={{ color: '#1890ff', fillColor: '#1890ff', fillOpacity: 0.2 }} />
              </MapContainer>
            </div>
            <div className="mt-2 text-center text-xs text-gray-500">Zone: Central Delhi (Radius: 8km)</div>
          </DashboardCard>
        </Col>

        <Col xs={24} lg={8}>
          <DashboardCard 
            title="Today's Route" 
            className="h-full"
            extra={<Button type="link" onClick={() => navigate('/salesperson/route')}>Open Map</Button>}
            loading={routeLoading}
            empty={visits.length === 0}
          >
            <List
              dataSource={visits}
              renderItem={(item: any, idx) => (
                <List.Item
                  className="cursor-pointer hover:bg-transparent transition-colors"
                  onClick={() => navigate(`/salesperson/visits/${item.id}`)}
                >
                  <List.Item.Meta
                    avatar={<div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{idx + 1}</div>}
                    title={
                      <div className="flex justify-between">
                        <span>{item.customer?.name || item.lead?.name}</span>
                        <Tag color={item.status === 'COMPLETED' ? 'green' : item.status === 'CHECKED_IN' ? 'blue' : 'default'}>
                          {item.status.replace('_', ' ')}
                        </Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div className="text-xs text-apple-textMuted mb-1"><EnvironmentOutlined /> {item.address}</div>
                        <div className="text-xs font-semibold">{new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <DashboardCard title="My Leads Pipeline" loading={leadsLoading}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <DashboardCard
            title="My Leads"
            loading={leadsLoading}
            extra={<Button type="link" onClick={() => navigate('/salesperson/leads')}>View All <ArrowRightOutlined /></Button>}
          >
            <List
              dataSource={leads.slice(0, 6)}
              renderItem={(lead: any) => (
                <List.Item
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg px-2 transition-colors"
                  onClick={() => navigate(`/salesperson/leads/${lead.id}`)}
                  actions={[
                    <Tag color={STATUS_COLORS[lead.status] || 'default'} key="status">
                      {lead.status.replace(/_/g, ' ')}
                    </Tag>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-600" />}
                    title={<span className="font-semibold text-sm">{lead.name}</span>}
                    description={
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span><PhoneOutlined className="mr-1" />{lead.phone}</span>
                        <span><EnvironmentOutlined className="mr-1" />{lead.city || lead.address || 'No location'}</span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </DashboardCard>
        </Col>
      </Row>

      {/* Floating Action Buttons Area */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 group z-[1000]">
        <Button 
          size="large" 
          type="primary" 
          shape="circle" 
          icon={<PlusOutlined />} 
          className="shadow-lg transform transition-transform hover:scale-110 w-14 h-14" 
          onClick={() => setScheduleModalOpen(true)}
        />
      </div>

      <VisitSchedulingModal 
        visible={scheduleModalOpen} 
        onCancel={() => setScheduleModalOpen(false)} 
      />
    </div>
  );
}
