import React, { useState, useEffect } from 'react';
import { Row, Col, Statistic, List, Tag, Badge, Progress } from 'antd';
import { Users, Building2, TrendingUp, HardDrive, Database, ShieldAlert, Activity, Server, Cpu } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { DashboardCard } from '../../components/DashboardCard';
import { io } from 'socket.io-client';

const mockActivityData = [
  { date: 'Mon', logins: 120, leads: 40, customers: 15 },
  { date: 'Tue', logins: 132, leads: 55, customers: 22 },
  { date: 'Wed', logins: 101, leads: 35, customers: 18 },
  { date: 'Thu', logins: 145, leads: 65, customers: 28 },
  { date: 'Fri', logins: 150, leads: 70, customers: 30 },
  { date: 'Sat', logins: 80, leads: 25, customers: 10 },
  { date: 'Sun', logins: 60, leads: 15, customers: 5 },
];

const mockRevenueSource = [
  { name: 'Direct Sales', value: 5500000, color: '#3b82f6' },
  { name: 'Dealer Network', value: 3200000, color: '#10b981' },
  { name: 'Zone Partners', value: 1800000, color: '#f59e0b' },
];

const mockAuditLog = [
  { id: 1, action: 'User Created', target: 'amit@lohia.com', actor: 'Admin User', time: '10 mins ago', type: 'success' },
  { id: 2, action: 'Role Updated', target: 'vikram.s', actor: 'Project Head', time: '1 hour ago', type: 'processing' },
  { id: 3, action: 'Config Changed', target: 'Escalation SLA', actor: 'Admin User', time: '3 hours ago', type: 'warning' },
  { id: 4, action: 'User Deactivated', target: 'suresh.m', actor: 'Admin User', time: '5 hours ago', type: 'error' },
];

const Dashboard: React.FC = () => {
  const [onlineUsers, setOnlineUsers] = useState<number>(142);
  const [systemMetrics, setSystemMetrics] = useState({ cpu: 45, memory: 62, db: 120 });

  useEffect(() => {
    // Connect to Socket for presence tracking
    const socket = io('http://localhost:3000', { autoConnect: false });
    // socket.connect();
    socket.on('ACTIVE_USERS', (data: { count: number }) => {
      setOnlineUsers(data.count);
    });
    
    // Simulate real-time metric fluctuations
    const interval = setInterval(() => {
      setSystemMetrics({
        cpu: Math.max(10, Math.min(100, Math.round(45 + (Math.random() * 20 - 10)))),
        memory: Math.max(20, Math.min(100, Math.round(62 + (Math.random() * 5 - 2)))),
        db: Math.max(50, Math.min(500, Math.round(120 + (Math.random() * 50 - 25)))),
      });
    }, 5000);

    return () => {
      socket.off('ACTIVE_USERS');
      clearInterval(interval);
    };
  }, []);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // return backendApi.get('/api/admin/dashboard').then(res => res.data.data);
      return { totalDealers: 18, totalCustomers: 4250, storageUsed: 42.5 };
    },
    refetchInterval: 30000
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: async () => mockActivityData,
    refetchInterval: 30000
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-revenue-source'],
    queryFn: async () => mockRevenueSource,
    refetchInterval: 30000
  });

  const stats = statsData || { totalDealers: 0, totalCustomers: 0, storageUsed: 0 };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center"><ShieldAlert className="mr-2 text-indigo-600"/> Administrator Console</h1>

      {/* KPI ROW */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard className="border-l-4 border-indigo-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Users size={16} className="mr-2"/> Active Users (Online Now)</span>}
              value={onlineUsers} 
              valueStyle={{ fontWeight: 'bold' }}
            />
            <div className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Sync
            </div>
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-slate-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Building2 size={16} className="mr-2"/> Active Dealers</span>}
              value={stats.totalDealers} 
              valueStyle={{ fontWeight: 'bold', color: '#475569' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-emerald-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><TrendingUp size={16} className="mr-2"/> Total Customers</span>}
              value={stats.totalCustomers} 
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-red-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><HardDrive size={16} className="mr-2"/> Storage Used</span>}
              value={stats.storageUsed} 
              suffix="GB"
              valueStyle={{ fontWeight: 'bold', color: '#ef4444' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* ACTIVITY CHART */}
        <Col xs={24} lg={16}>
          <DashboardCard title={<span className="flex items-center"><Activity size={18} className="mr-2 text-apple-textMuted"/> System Activity (7 Days)</span>} loading={activityLoading} className="h-full">
            <div className="h-80 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="logins" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLogins)" name="User Logins" />
                  <Area type="monotone" dataKey="customers" stroke="#10b981" fillOpacity={1} fill="url(#colorCustomers)" name="New Customers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </Col>

        {/* REVENUE BY SOURCE */}
        <Col xs={24} lg={8}>
          <DashboardCard title="Revenue by Source (YTD)" loading={revenueLoading} className="h-full">
            <div className="h-64 mt-4 w-full flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueData || []} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {(revenueData || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
         {/* HEALTH DASHBOARD */}
         <Col xs={24} lg={8}>
           <DashboardCard title={<span className="flex items-center"><Cpu size={18} className="mr-2 text-apple-textMuted"/> Real-time System Metrics</span>} className="h-full">
              <div className="space-y-4 pt-2">
                 <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1">
                      <span className="flex items-center"><Cpu size={14} className="mr-2"/> CPU Usage</span>
                      <span className={systemMetrics.cpu > 80 ? 'text-red-500' : 'text-emerald-500'}>{systemMetrics.cpu}%</span>
                    </div>
                    <Progress percent={systemMetrics.cpu} showInfo={false} strokeColor={systemMetrics.cpu > 80 ? '#ef4444' : '#10b981'} size="small" />
                 </div>
                 <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1">
                      <span className="flex items-center"><Server size={14} className="mr-2"/> Memory Usage</span>
                      <span className={systemMetrics.memory > 85 ? 'text-red-500' : 'text-blue-500'}>{systemMetrics.memory}%</span>
                    </div>
                    <Progress percent={systemMetrics.memory} showInfo={false} strokeColor={systemMetrics.memory > 85 ? '#ef4444' : '#3b82f6'} size="small" />
                 </div>
                 <div>
                    <div className="flex justify-between items-center text-sm font-semibold mb-1">
                      <span className="flex items-center"><Database size={14} className="mr-2"/> DB Queries / sec</span>
                      <span className="text-amber-500">{systemMetrics.db} qps</span>
                    </div>
                    <Progress percent={Math.min(100, (systemMetrics.db/500)*100)} showInfo={false} strokeColor="#f59e0b" size="small" />
                 </div>
              </div>
              <div className="mt-6 space-y-3">
                 <div className="flex justify-between items-center p-3 bg-transparent dark:bg-slate-800 rounded border border-transparent dark:border-slate-700">
                    <span className="font-semibold flex items-center"><Database size={16} className="mr-2 text-apple-gray"/> Primary Postgres</span>
                    <Badge status="success" text="Connected" />
                 </div>
                 <div className="flex justify-between items-center p-3 bg-transparent dark:bg-slate-800 rounded border border-transparent dark:border-slate-700">
                    <span className="font-semibold flex items-center"><HardDrive size={16} className="mr-2 text-apple-gray"/> S3 Storage</span>
                    <Badge status="warning" text="Elevated Latency" />
                 </div>
              </div>
           </DashboardCard>
         </Col>

         {/* AUDIT LOG PREVIEW */}
         <Col xs={24} lg={16}>
           <DashboardCard title="Recent Technical Audit Log" extra={<a href="/admin/audit" className="text-blue-600 text-sm">View All</a>} className="h-full">
              <List
                itemLayout="horizontal"
                dataSource={mockAuditLog}
                renderItem={item => (
                  <List.Item className="border-b border-transparent dark:border-slate-700 py-3">
                    <List.Item.Meta
                      avatar={<Tag color={item.type as any} className="w-24 text-center">{item.action}</Tag>}
                      title={<span className="font-medium">Target: {item.target}</span>}
                      description={<span className="text-xs text-apple-textMuted">Performed by {item.actor} • {item.time}</span>}
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
