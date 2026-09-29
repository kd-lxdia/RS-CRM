import React, { useState, useEffect } from 'react';
import { Row, Col, Statistic, List, Badge, Table, Alert, Progress } from 'antd';
import { Package, AlertTriangle, XCircle, Truck, PackagePlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { DashboardCard } from '../../components/DashboardCard';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { io } from 'socket.io-client';

// Mock data
const mockStats = {
  inStock: 145,
  lowStock: 12,
  outOfStock: 3,
  pendingDispatch: 8,
  todayDispatch: 5
};

const topNeededItems = [
  { id: 1, item: 'Growatt MIN 5000', shortage: 15, neededFor: 4 },
  { id: 2, item: 'Solar Cable 4sqmm (Roll)', shortage: 8, neededFor: 8 },
  { id: 3, item: 'MC4 Branch Connectors', shortage: 45, neededFor: 9 },
  { id: 4, item: 'ACDB Box Single Phase', shortage: 12, neededFor: 6 },
  { id: 5, item: 'Earth Pit Cover', shortage: 20, neededFor: 10 },
  { id: 6, item: 'Lightning Arrester', shortage: 5, neededFor: 5 },
  { id: 7, item: 'Galvanized Structure (Set)', shortage: 3, neededFor: 3 },
  { id: 8, item: 'Trina Solar 540W', shortage: 120, neededFor: 8 },
  { id: 9, item: 'DCDB Box', shortage: 6, neededFor: 6 },
  { id: 10, item: 'Earthing Chemical Strip', shortage: 40, neededFor: 20 },
];

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const Dashboard: React.FC = () => {
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Connect to Socket for live stock alerts
    const socket = io('http://localhost:3000', { autoConnect: false });
    // socket.connect();
    socket.on('LOW_STOCK_ALERT', (data: any) => {
      setLiveAlerts(prev => [data, ...prev].slice(0, 5)); // Keep last 5
    });
    return () => {
      socket.off('LOW_STOCK_ALERT');
    };
  }, []);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['warehouse-stats'],
    queryFn: async () => {
      // return backendApi.get('/api/warehouse/stats').then(res => res.data.data);
      return mockStats;
    },
    refetchInterval: 30000
  });

  const { data: neededItemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['warehouse-needed-items'],
    queryFn: async () => {
      return topNeededItems;
    },
    refetchInterval: 30000
  });

  const { data: readinessData, isLoading: readinessLoading } = useQuery({
    queryKey: ['warehouse-dispatch-readiness'],
    queryFn: async () => {
      return [
        { name: 'Fully Ready', value: 45 },
        { name: 'Partial Stock', value: 30 },
        { name: 'Waiting Restock', value: 25 },
      ];
    },
    refetchInterval: 30000
  });

  const stats = statsData || mockStats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Warehouse Dashboard</h1>

      {liveAlerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {liveAlerts.map((alert, idx) => (
            <Alert 
              key={idx}
              message={`Low Stock Alert: ${alert.itemName} is running low (${alert.currentQty} remaining). Triggered by: ${alert.trigger}`}
              type="warning"
              showIcon
              closable
              onClose={() => setLiveAlerts(prev => prev.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}

      {/* STOCK HEALTH SUMMARY */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-green-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Package size={16} className="mr-2"/> Items In Stock</span>}
              value={stats.inStock} 
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={8}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-amber-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><AlertTriangle size={16} className="mr-2"/> Low Stock Items</span>}
              value={stats.lowStock} 
              valueStyle={{ fontWeight: 'bold', color: '#f59e0b' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={8}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-red-500 bg-red-50/10 dark:bg-red-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><XCircle size={16} className="mr-2"/> Out of Stock Items</span>}
              value={stats.outOfStock} 
              valueStyle={{ fontWeight: 'bold', color: '#ef4444' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* PIPELINE DISPATCH READINESS */}
        <Col xs={24} lg={10}>
          <DashboardCard title="Pipeline Dispatch Readiness" loading={readinessLoading} className="h-full">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={readinessData || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(readinessData || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [`${value}%`, 'Customers']} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-sm text-gray-500 mt-2">
              % of pending customers by stock availability
            </div>
          </DashboardCard>
        </Col>

        {/* MOST NEEDED ITEMS */}
        <Col xs={24} lg={14}>
          <DashboardCard 
            title={<span className="text-red-500 flex items-center"><AlertTriangle size={18} className="mr-2"/> Top 10 Most-Needed Out-Of-Stock Items</span>} 
            loading={itemsLoading}
            className="h-full"
            empty={neededItemsData?.length === 0}
          >
            <Table
              dataSource={neededItemsData || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Rank', render: (_: any, __: any, idx: number) => <span className="font-bold text-gray-400">#{idx + 1}</span>, width: 60 },
                { title: 'Item Name', dataIndex: 'item', key: 'item', render: (text: string) => <span className="font-medium">{text}</span> },
                { title: 'Shortage Qty', dataIndex: 'shortage', key: 'shortage', render: (val: number) => <span className="text-red-500 font-bold">{val}</span> },
                { title: 'Needed For Customers', dataIndex: 'neededFor', key: 'neededFor', render: (val: number) => <Badge count={val} color="blue" /> },
              ]}
            />
          </DashboardCard>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
