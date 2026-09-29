import React, { useMemo } from 'react';
import { Row, Col, Statistic, List, Badge, Alert, Spin } from 'antd';
import { Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { DashboardCard } from '../../components/DashboardCard';

const Dashboard: React.FC = () => {
  const { data: customerData, isLoading: customersLoading } = useQuery({
    queryKey: ['doc-my-customers'],
    queryFn: async () => {
      const res = await backendApi.get('/documentation/my-customers');
      return res.data.data;
    },
    refetchInterval: 30000
  });

  const { data: ganttData, isLoading: ganttLoading } = useQuery({
    queryKey: ['doc-scheme-progress'],
    queryFn: async () => {
      return [
        { category: 'PM Surya Ghar', completed: 75, remaining: 25 },
        { category: 'CM Scheme', completed: 40, remaining: 60 },
        { category: 'Loan Process', completed: 60, remaining: 40 },
        { category: 'Net Metering', completed: 90, remaining: 10 },
      ];
    },
    refetchInterval: 30000
  });

  const customers = customerData || [];
  
  const stats = useMemo(() => {
    return {
      total: customers.length,
      complete: customers.filter((c: any) => c.completionPercentage === 100).length,
      inProgress: customers.filter((c: any) => c.completionPercentage > 0 && c.completionPercentage < 100).length,
      overdue: customers.filter((c: any) => (c.completionPercentage || 0) < 100).length
    };
  }, [customers]);

  const overdueCustomers = useMemo(
    () => customers.filter((c: any) => (c.completionPercentage || 0) < 100),
    [customers]
  );
  const maxOverdueDays = overdueCustomers.length > 0 ? 1 : 0;

  if (customersLoading && customers.length === 0) {
    return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-6 p-4">
      {overdueCustomers.length > 0 && (
        <Alert
          message={`Action Required: You have customers with documentation overdue up to ${maxOverdueDays} days!`}
          type="error"
          showIcon
          banner
          className="rounded-md"
        />
      )}

      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold mb-0">Documentation Dashboard</h1>
      </div>

      {/* SUMMARY CARDS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={customersLoading} className="border-l-4 border-l-blue-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Users size={16} className="mr-2"/> Total Customers</span>}
              value={stats.total} 
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={customersLoading} className="border-l-4 border-l-green-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><CheckCircle size={16} className="mr-2"/> Complete</span>}
              value={stats.complete} 
              valueStyle={{ color: '#10b981' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={customersLoading} className="border-l-4 border-l-amber-500">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><Clock size={16} className="mr-2"/> In Progress</span>}
              value={stats.inProgress} 
              valueStyle={{ color: '#f59e0b' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={customersLoading} className="border-l-4 border-l-red-500 bg-red-50/10 dark:bg-red-900/10">
            <Statistic 
              title={<span className="text-apple-textMuted font-medium flex items-center"><AlertTriangle size={16} className="mr-2"/> Overdue</span>}
              value={stats.overdue} 
              valueStyle={{ color: '#ef4444' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* PROGRESS GANTT BARS */}
        <Col xs={24} xl={16}>
          <DashboardCard title="Scheme Progress Completion" loading={ganttLoading} className="h-full">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ganttData || []} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} width={120} />
                  <RechartsTooltip formatter={(value: any, name: any) => [`${value}%`, name === 'completed' ? 'Completed' : 'Remaining']} />
                  <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} barSize={20} />
                  <Bar dataKey="remaining" stackId="a" fill="#f3f4f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs mt-2 text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm"></span> Completed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-200 rounded-sm"></span> Remaining</span>
            </div>
          </DashboardCard>
        </Col>

        {/* OVERDUE CUSTOMERS SECTION */}
        <Col xs={24} xl={8}>
          <DashboardCard 
            title={<span className="text-red-500 flex items-center"><AlertTriangle size={18} className="mr-2"/> Overdue Customers</span>} 
            className="h-full border border-red-100"
            loading={customersLoading}
            empty={overdueCustomers.length === 0}
            emptyMessage="No overdue customers. Great job!"
          >
            <List
              itemLayout="horizontal"
              dataSource={overdueCustomers}
              renderItem={(item: any) => (
                <List.Item
                  actions={[<a key="view" className="text-blue-600 text-xs font-semibold">VIEW</a>]}
                  className="hover:bg-transparent transition-colors px-2 -mx-2 rounded cursor-pointer"
                >
                  <List.Item.Meta
                    avatar={
                      <div className="bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                        {item.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                    }
                    title={<span className="font-semibold">{item.name}</span>}
                    description={
                      <div className="flex items-center space-x-3 mt-1 text-xs">
                         <span className="text-red-500 font-medium">Documentation pending</span>
                         <Badge status="processing" text={`${item.completionPercentage}% Complete`} />
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
