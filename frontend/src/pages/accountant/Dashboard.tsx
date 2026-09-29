import React from 'react';
import { Row, Col, Statistic, List, Button } from 'antd';
import { IndianRupee, TrendingUp, AlertCircle, FileText, Phone } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DashboardCard } from '../../components/DashboardCard';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const mockCashFlowData = [
  { month: 'Apr', expected: 500000, received: 450000 },
  { month: 'May', expected: 550000, received: 520000 },
  { month: 'Jun', expected: 600000, received: 610000 },
  { month: 'Jul', expected: 650000, received: 580000 },
  { month: 'Aug', expected: 700000, received: 720000 },
  { month: 'Sep', expected: 750000, received: 650000 },
  { month: 'Oct', expected: 800000, received: 890000 },
  { month: 'Nov', expected: 900000, received: 1050000 },
  { month: 'Dec', expected: 950000, received: 920000 },
  { month: 'Jan', expected: 1000000, received: 1100000 },
  { month: 'Feb', expected: 1200000, received: 1250000 },
  { month: 'Mar', expected: 1500000, received: 1450000 },
];

const mockAgingData = [
  { name: '0-30 Days', value: 450000, color: '#10b981' },
  { name: '30-60 Days', value: 250000, color: '#f59e0b' },
  { name: '60-90 Days', value: 100000, color: '#f97316' },
  { name: '90+ Days', value: 50000, color: '#ef4444' },
];

const topOverdue = [
  { id: 1, name: 'Vikram Singh', amount: '₹1,50,000', days: 45 },
  { id: 2, name: 'Neha Patel', amount: '₹85,000', days: 28 },
  { id: 3, name: 'Rajesh Kumar', amount: '₹45,000', days: 15 },
  { id: 4, name: 'Anjali Desai', amount: '₹1,10,000', days: 60 },
  { id: 5, name: 'Suresh Menon', amount: '₹25,000', days: 10 },
];

const Dashboard: React.FC = () => {
  const { data: finances, isLoading: financesLoading } = useQuery({
    queryKey: ['accountant-finances'],
    queryFn: async () => {
      // Mocked Backend Call
      // return backendApi.get('/api/finances/summary').then(res => res.data.data);
      return { collected: 1450000, outstanding: 2850000, overdue: 850000, unbilled: 4200000 };
    },
    refetchInterval: 30000
  });

  const { data: cashFlow, isLoading: flowLoading } = useQuery({
    queryKey: ['accountant-cashflow'],
    queryFn: async () => mockCashFlowData,
    refetchInterval: 30000
  });

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: ['accountant-aging'],
    queryFn: async () => mockAgingData,
    refetchInterval: 30000
  });

  const stats = finances || { collected: 0, outstanding: 0, overdue: 0, unbilled: 0 };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Financial Dashboard</h1>

      {/* KPI ROW */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={financesLoading} className="border-l-4 border-l-green-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><TrendingUp size={16} className="mr-2"/> Collected This Month</span>}
              value={stats.collected} 
              prefix="₹"
              valueStyle={{ fontWeight: 'bold', color: '#10b981' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={financesLoading} className="border-l-4 border-l-amber-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><IndianRupee size={16} className="mr-2"/> Total Outstanding</span>}
              value={stats.outstanding} 
              prefix="₹"
              valueStyle={{ fontWeight: 'bold', color: '#f59e0b' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={financesLoading} className="border-l-4 border-l-red-500 bg-red-50/10 dark:bg-red-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><AlertCircle size={16} className="mr-2"/> Total Overdue</span>}
              value={stats.overdue} 
              prefix="₹"
              valueStyle={{ fontWeight: 'bold', color: '#ef4444' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={financesLoading} className="border-l-4 border-l-blue-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><FileText size={16} className="mr-2"/> Pipeline Unbilled</span>}
              value={stats.unbilled} 
              prefix="₹"
              valueStyle={{ fontWeight: 'bold', color: '#3b82f6' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* CASH FLOW COMPOSED CHART */}
        <Col xs={24} lg={16}>
          <DashboardCard title="Cash Flow (Expected vs Received)" loading={flowLoading} className="h-full">
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashFlow || []} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val: any) => `₹${val/100000}L`} />
                  <RechartsTooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']} />
                  <Legend verticalAlign="top" height={36}/>
                  <Bar dataKey="expected" name="Expected" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="received" name="Received" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </Col>

        {/* METRICS & OVERDUE */}
        <Col xs={24} lg={8} className="space-y-6">
          {/* OUTSTANDING AGING REPORT */}
          <DashboardCard title="Outstanding Aging Report" loading={agingLoading}>
             <div className="h-48 w-full flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={aging || []}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(aging || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="flex flex-wrap justify-center gap-4 mt-2">
                {(aging || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center text-xs">
                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: m.color }}></span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{m.name}</span>
                  </div>
                ))}
             </div>
          </DashboardCard>

          <DashboardCard 
            title={<span className="text-red-600 flex items-center font-bold font-sans"><AlertCircle size={18} className="mr-2"/> Top Overdue Customers</span>} 
            className="border-red-200"
          >
            <List
              itemLayout="horizontal"
              dataSource={topOverdue}
              renderItem={item => (
                <List.Item
                  actions={[<Button key="call" size="small" type="primary" danger ghost icon={<Phone size={14}/>}>Call</Button>]}
                >
                  <List.Item.Meta
                    title={<span className="font-semibold">{item.name}</span>}
                    description={<span className="text-red-500 font-medium text-xs">{item.days} days overdue</span>}
                  />
                  <div className="font-bold text-apple-textLight dark:text-apple-textDark dark:text-slate-100">{item.amount}</div>
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
