import React, { useState, useEffect } from 'react';
import { Row, Col, Progress, Statistic, Table, Tag, Button, message } from 'antd';
import { AlertTriangle, Clock, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, FunnelChart, Cell, Funnel, LabelList } from 'recharts';
import { DashboardCard } from '../../components/DashboardCard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import { io } from 'socket.io-client';

const mockTeamData = [
  { name: 'Rahul W.', assigned: 25, completed: 18 },
  { name: 'Amit S.', assigned: 20, completed: 12 },
  { name: 'Vikram S.', assigned: 15, completed: 14 },
  { name: 'Priya P.', assigned: 10, completed: 9 },
  { name: 'Arjun M.', assigned: 30, completed: 10 },
];

const mockFunnelData = [
  { value: 4500000, name: 'Pipeline Value', fill: '#3b82f6' },
  { value: 2850000, name: 'Invoiced Value', fill: '#f59e0b' },
  { value: 1450000, name: 'Collected (Realized)', fill: '#10b981' },
];

const initialStageHealth = [
  { stage: 'Documentation', count: 42, overdue: 5, sla: 92 },
  { stage: 'Site Survey', count: 18, overdue: 1, sla: 98 },
  { stage: 'Procurement', count: 30, overdue: 12, sla: 76 },
  { stage: 'Dispatch', count: 15, overdue: 0, sla: 100 },
  { stage: 'Installation', count: 25, overdue: 4, sla: 85 },
];

const Dashboard: React.FC = () => {
  const [liveStageHealth, setLiveStageHealth] = useState(initialStageHealth);
  const queryClient = useQueryClient();

  useEffect(() => {
    // In a real app this connects to the authenticated socket properly
    const socket = io('http://localhost:3000', { autoConnect: false });
    // socket.connect();
    socket.on('CUSTOMER_STAGE_CHANGED', (data: any) => {
      // simulate real-time pipeline health push updates
      setLiveStageHealth(prev => prev.map(s => {
        if (s.stage.toLowerCase() === data.stage?.toLowerCase()) {
          return { ...s, count: s.count + 1 };
        }
        if (s.stage.toLowerCase() === data.oldStage?.toLowerCase()) {
          return { ...s, count: Math.max(0, s.count - 1) };
        }
        return s;
      }));
    });
    return () => {
      socket.off('CUSTOMER_STAGE_CHANGED');
    };
  }, []);

  // Poll for latest stats (30 seconds)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['project-head-stats'],
    queryFn: async () => {
      // Mocking API call for dashboard specific metrics
      // const res = await backendApi.get('/api/dashboard/project-head');
      // return res.data.data;
      return { escalations: 8, warnings: 15 };
    },
    refetchInterval: 30000
  });

  const { data: salesPerformance = [], isLoading: salesLoading } = useQuery({
    queryKey: ['project-head-sales-performance'],
    queryFn: async () => {
      const res = await backendApi.get('/epc-v2/reports/sales-performance');
      return res.data.data || [];
    },
    refetchInterval: 30000,
  });

  const { data: pendingQuotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: ['project-head-pending-quotation-approvals'],
    queryFn: async () => {
      const res = await backendApi.get('/epc-v2/quotations/pending-approval');
      return res.data.data || [];
    },
    refetchInterval: 30000,
  });

  const approveQuotation = useMutation({
    mutationFn: async (quotationId: string) => {
      const res = await backendApi.post(`/epc-v2/quotations/${quotationId}/project-head-approve`, {
        remarks: 'Approved by Project Head manager control',
      });
      return res.data.data;
    },
    onSuccess: () => {
      message.success('Quotation approved');
      queryClient.invalidateQueries({ queryKey: ['project-head-pending-quotation-approvals'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error?.message || 'Failed to approve quotation');
    },
  });

  const slaColumns = [
    { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (text: string) => <span className="font-semibold">{text}</span> },
    { title: 'Active', dataIndex: 'count', key: 'count' },
    { title: 'SLA Compliance (%)', dataIndex: 'sla', key: 'sla', render: (val: number) => (
      <div className="flex items-center gap-2">
        <Progress percent={val} size="small" status={val > 90 ? 'success' : val > 80 ? 'normal' : 'exception'} />
      </div>
    )}
  ];

  const salesColumns = [
    { title: 'Salesperson', dataIndex: 'salesperson', key: 'salesperson', render: (text: string) => <span className="font-semibold">{text}</span> },
    { title: 'Leads', dataIndex: 'leadsAssigned', key: 'leadsAssigned' },
    { title: 'Won', dataIndex: 'wonLeads', key: 'wonLeads', render: (value: number) => <Tag color="green">{value}</Tag> },
    { title: 'Lost', dataIndex: 'lostLeads', key: 'lostLeads', render: (value: number) => <Tag color="red">{value}</Tag> },
    { title: 'Projects', dataIndex: 'projectsOwned', key: 'projectsOwned' },
    { title: 'Collection', dataIndex: 'collectionReceived', key: 'collectionReceived', render: (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}` },
    { title: 'Pending', dataIndex: 'paymentPending', key: 'paymentPending', render: (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}` },
    { title: 'Conversion', dataIndex: 'conversionPercent', key: 'conversionPercent', render: (value: number) => `${value || 0}%` },
  ];

  const quotationColumns = [
    { title: 'Project / Lead', dataIndex: 'projectCode', key: 'projectCode', render: (_: string, row: any) => row.projectCode || row.leadCode || 'Direct quote' },
    { title: 'Customer', dataIndex: 'customerName', key: 'customerName', render: (text: string) => text || 'Not linked' },
    { title: 'Module', dataIndex: 'module', key: 'module' },
    { title: 'Selling Price', dataIndex: 'sellingPrice', key: 'sellingPrice', render: (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}` },
    { title: 'Margin', dataIndex: 'marginPercent', key: 'marginPercent', render: (value: number) => <Tag color={Number(value) < 8 ? 'red' : 'orange'}>{value}%</Tag> },
    { title: 'Status', dataIndex: 'approvalStatus', key: 'approvalStatus', render: (value: string) => <Tag color={value === 'APPROVED' ? 'green' : 'gold'}>{value}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, row: any) => (
        <Button
          type="primary"
          size="small"
          loading={approveQuotation.isPending && approveQuotation.variables === row.quotationId}
          onClick={() => approveQuotation.mutate(row.quotationId)}
        >
          Approve
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold mb-0">Operations Command Center</h1>
      </div>

      {/* INBOX */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-red-500 bg-red-50/10 dark:bg-red-900/10">
            <Statistic 
              title={<span className="text-red-600 dark:text-red-400 font-bold flex items-center"><AlertTriangle size={16} className="mr-2"/> CRITICAL ESCALATIONS (&gt;4 Days)</span>}
              value={statsData?.escalations || 0} 
              valueStyle={{ color: '#b91c1c', fontWeight: 'bold' }}
            />
          </DashboardCard>
        </Col>
        <Col xs={24} md={12}>
          <DashboardCard loading={statsLoading} className="border-l-4 border-l-amber-500 bg-amber-50/10 dark:bg-amber-900/10">
            <Statistic 
              title={<span className="text-amber-600 dark:text-amber-400 font-bold flex items-center"><Clock size={16} className="mr-2"/> SLA WARNINGS (2-4 Days)</span>}
              value={statsData?.warnings || 0} 
              valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* STAGE HEALTH */}
        <Col xs={24} lg={8}>
          <DashboardCard title="Real-time Pipeline Health" className="h-full">
            <div className="space-y-6">
              {liveStageHealth.map((s, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1 font-medium">
                    <span>{s.stage} <span className="text-xs font-mono opacity-50">({s.count})</span></span>
                    {s.overdue > 0 ? (
                      <span className="text-red-500 font-bold">{s.overdue} Delayed</span>
                    ) : (
                      <span className="text-emerald-500 font-bold">On Track</span>
                    )}
                  </div>
                  <Progress 
                    percent={100} 
                    success={{ percent: ((s.count - s.overdue) / s.count) * 100, strokeColor: '#10b981' }} 
                    strokeColor="#ef4444" 
                    showInfo={false} 
                    size="small"
                  />
                </div>
              ))}
            </div>
          </DashboardCard>
        </Col>

        {/* TEAM WORKLOAD */}
        <Col xs={24} lg={8}>
          <DashboardCard title={<span className="flex items-center"><Users size={18} className="mr-2"/> Team Workload</span>} className="h-full" bodyStyle={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockTeamData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={70} />
                <RechartsTooltip />
                <Bar dataKey="assigned" name="Assigned" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </DashboardCard>
        </Col>

        {/* REVENUE PIPELINE */}
        <Col xs={24} lg={8}>
          <DashboardCard title={<span className="flex items-center"><TrendingUp size={18} className="mr-2"/> Revenue Pipeline</span>} className="h-full" bodyStyle={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <RechartsTooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']} />
                <Funnel dataKey="value" data={mockFunnelData} isAnimationActive>
                  <LabelList position="right" fill="#888" stroke="none" dataKey="name" fontSize={12} fontWeight={600} />
                  {mockFunnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <DashboardCard title="SLA Compliance Rate">
            <Table 
              dataSource={liveStageHealth} 
              columns={slaColumns} 
              rowKey="stage" 
              pagination={false} 
              size="middle"
            />
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <DashboardCard title="Salesperson Performance - Manager View">
            <Table
              dataSource={salesPerformance}
              columns={salesColumns}
              rowKey={(row: any) => row.email || row.salesperson}
              loading={salesLoading}
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </DashboardCard>
        </Col>
        <Col xs={24}>
          <DashboardCard title="Low Margin Quotation Approval Queue">
            <Table
              dataSource={pendingQuotations}
              columns={quotationColumns}
              rowKey={(row: any) => row.quotationId}
              loading={quotationsLoading}
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </DashboardCard>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
